import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';

// Create a separate validator constraint class for better type safety
@ValidatorConstraint({ name: 'strongPassword' })
class StrongPasswordConstraint implements ValidatorConstraintInterface {
  message = 'Password validation failed';

  validate(value: unknown): boolean {
    // Check existence first (existence group)
    if (!value) {
      this.message = 'Password cannot be empty';
      return false;
    }

    // Check type (existence group)
    if (typeof value !== 'string') {
      this.message = 'Password must be a string';
      return false;
    }

    // Check length (format group)
    if (value.length < 8) {
      this.message = 'Password must be at least 8 characters long';
      return false;
    }

    // Check for letter (format group)
    if (!/(?=.*[a-zA-Z])/.test(value)) {
      this.message = 'Password must contain at least one letter';
      return false;
    }

    // Check for number (format group)
    if (!/(?=.*\d)/.test(value)) {
      this.message = 'Password must contain at least one number';
      return false;
    }

    // Check for special character (format group)
    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(value)) {
      this.message = 'Password must contain at least one special character';
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return this.message;
  }
}

export function StrongPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'strongPassword',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: {
        groups: ['existence', 'format'],
        ...validationOptions,
      },
      validator: StrongPasswordConstraint,
    });
  };
}
