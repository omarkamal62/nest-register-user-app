import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, connect, Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

// interface UserRegistrationData {
//   name: string;
//   email: string;
//   password: string;
//   [key: string]: any; // For any additional fields
// }

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
}

interface LoginResponseError {
  message: string[] | string; // Can be array of strings or single string
  statusCode: number;
  error: string;
}

describe('AuthController (e2e)', () => {
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
    app.useGlobalPipes(new ValidationPipe());
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

  // Helper function to create a test user with hashed password
  const createTestUser = async (userData: {
    name: string;
    email: string;
    password: string;
    [key: string]: any;
  }) => {
    // Create the user with plain password (middleware will hash it)
    await userModel.create(userData);

    // Verify the user was created and password was correctly hashed
    const savedUser = await userModel.findOne({ email: userData.email });
    if (!savedUser) {
      throw new Error(`Test user ${userData.email} was not created`);
    }

    // Verify password can be validated
    const passwordValid = await bcrypt.compare(
      userData.password,
      savedUser.password,
    );
    if (!passwordValid) {
      throw new Error('Password validation failed for test user');
    }

    return savedUser;
  };

  describe('/api/auth/login (POST)', () => {
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    beforeEach(async () => {
      await createTestUser(testUser);
    });

    it('should successfully login with valid credentials', async () => {
      const credentials: LoginCredentials = {
        email: testUser.email,
        password: testUser.password,
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credentials)
        .expect(201);

      const responseBody = response.body as LoginResponse;
      expect(responseBody).toHaveProperty('accessToken');
      expect(typeof responseBody.accessToken).toBe('string');
      expect(responseBody.accessToken.length).toBeGreaterThan(0);
    });

    it('should fail login with incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should fail login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: testUser.password,
        })
        .expect(400);

      console.log('Validation error response:', response.body); // Temporary debug log

      const responseBody = response.body as LoginResponseError;

      // Check if message is an array
      if (Array.isArray(responseBody.message)) {
        // Check for typical email validation phrases
        const hasEmailError = responseBody.message.some(
          (err) =>
            err.includes('email') ||
            err.includes('Email') ||
            err.includes('valid'),
        );
        expect(hasEmailError).toBeTruthy();
      } else {
        // If it's a string, check for typical phrases
        const hasEmailError =
          responseBody.message.includes('email') ||
          responseBody.message.includes('Email') ||
          responseBody.message.includes('valid');
        expect(hasEmailError).toBeTruthy();
      }
    });

    it('should require email and password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);

      const responseBody = response.body as LoginResponseError;

      // Check message properly based on its type
      if (Array.isArray(responseBody.message)) {
        // If it's an array, check length
        expect(responseBody.message.length).toBeGreaterThan(0);

        // Optional: Check for specific validation messages
        const hasEmailError = responseBody.message.some(
          (err) => err.includes('email') || err.includes('Email'),
        );
        const hasPasswordError = responseBody.message.some(
          (err) => err.includes('password') || err.includes('Password'),
        );

        expect(hasEmailError || hasPasswordError).toBeTruthy();
      } else {
        // If it's a string, just verify it exists
        expect(responseBody.message).toBeTruthy();
      }
    });

    // Test for authenticated route using JWT
    describe('authenticated routes', () => {
      let authToken: string;

      beforeEach(async () => {
        // Login to get a valid token
        const loginResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password,
          });

        // Type the response properly
        const responseBody = loginResponse.body as LoginResponse;

        // Extract token with proper typing
        authToken = responseBody.accessToken;

        // Verify token was retrieved successfully
        expect(authToken).toBeDefined();
        expect(typeof authToken).toBe('string');
        expect(authToken.length).toBeGreaterThan(0);
      });

      it('should access profile with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Check returned user data
        expect(response.body).toHaveProperty('name', testUser.name);
        expect(response.body).toHaveProperty('email', testUser.email);
        expect(response.body).not.toHaveProperty('password');
      });

      it('should reject requests without token', async () => {
        await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      });

      it('should reject requests with invalid token', async () => {
        await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });
  });
});
