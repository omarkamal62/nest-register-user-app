import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { User, UserSchema } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { ValidationExceptionFilter } from '../common/filters/validation-exception.filter';

interface RegisterResponse {
  message: string;
}

interface UserRegistrationData {
  name: string;
  email: string;
  password: string;
  [key: string]: any; // For any additional fields
}

interface ValidationErrorResponse {
  statusCode: number;
  error: string;
  validationErrors: {
    [field: string]: string[];
  };
}

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;
  let userModel: Model<User>;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoConnection = (await connect(mongoUri)).connection;

    // Create the user model
    userModel = mongoConnection.model('User', UserSchema);

    // Create the NestJS testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getModelToken('User'))
      .useValue(userModel)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
        groups: ['existence', 'format'],
        exceptionFactory: (errors) => {
          return new BadRequestException(errors);
        },
      }),
    );

    // Apply the custom ValidationExceptionFilter
    app.useGlobalFilters(new ValidationExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (mongoConnection) {
      await mongoConnection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    await app.close();
  });

  afterEach(async () => {
    await userModel.deleteMany({});
  });

  const createTestUser = async (userData: UserRegistrationData) => {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    return userModel.create({
      ...userData,
      password: hashedPassword,
    });
  };

  // Test data
  const validRegistrationData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123!', // Meets all validation rules
  };

  describe('/api/users/register (POST)', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/register')
        .send(validRegistrationData)
        .expect(201);

      const responseBody = response.body as RegisterResponse;

      // Check that we got a success response
      expect(responseBody).toHaveProperty('message');
      expect(responseBody.message).toBe('User registered successfully');

      // Check that the user was actually created in the database
      const user = await userModel.findOne({
        email: validRegistrationData.email,
      });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      if (user) {
        expect(user.name).toBe(validRegistrationData.name);
        expect(user.email).toBe(validRegistrationData.email);

        // Verify the password is hashed, not stored as plaintext
        expect(user.password).not.toBe(validRegistrationData.password);
      } else {
        fail('User should not be null');
      }
    });

    it('should not register a user with an email that already exists', async () => {
      // First, create a user with the email
      await createTestUser(validRegistrationData);

      // Now try to register with the same email
      const response = await request(app.getHttpServer())
        .post('/api/users/register')
        .send(validRegistrationData)
        .expect(409); // Conflict

      const responseBody = response.body as RegisterResponse;

      expect(responseBody).toHaveProperty('message');
      expect(responseBody.message).toBe('Email already registered');
    });

    describe('input validation', () => {
      // Test cases with invalid data and expected error messages
      it.each([
        // [fieldName, invalidValue, expectedErrorMessage]
        ['name', 'T', 'Name must be at least 3 characters long'],
        ['email', 'not-an-email', 'Please provide a valid email address'],
        ['password', '123', 'Password must be at least 8 characters long'],
        [
          'password',
          'password123',
          'Password must contain at least one special character',
        ],
        [
          'password',
          'Password!@#',
          'Password must contain at least one number',
        ],
        [
          'password',
          '12345678!@#',
          'Password must contain at least one letter',
        ],
      ])(
        'should validate %s field with error: %s',
        async (field, value, expectedError) => {
          // Create valid data first
          const validData = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'Valid1Password!',
          };

          // Then override just the field we want to test
          const testData = {
            ...validData,
            [field]: value,
          };

          const response = await request(app.getHttpServer())
            .post('/api/users/register')
            .send(testData)
            .expect(400);

          // Update to match the new validation error response format

          const responseBody = response.body as ValidationErrorResponse;

          // Check that we have the validation errors object
          expect(responseBody).toHaveProperty('validationErrors');

          // Check that the specific field has validation errors
          expect(responseBody.validationErrors).toHaveProperty(field);

          // Check that the specific error message is included
          const fieldErrors = responseBody.validationErrors[field];
          expect(
            fieldErrors.some((err) => err.includes(expectedError)),
          ).toBeTruthy();
        },
      );

      it('should accept valid registration data', async () => {
        const validData = {
          name: 'Test User',
          email: 'test@example.com',
          password: 'Valid1Password!',
        };

        const response = await request(app.getHttpServer())
          .post('/api/users/register')
          .send(validData)
          .expect(201);

        // Change RegisterResponseSuccess to RegisterResponse
        const responseBody = response.body as RegisterResponse;
        expect(responseBody.message).toBe('User registered successfully');
      });
    });
  });
});
