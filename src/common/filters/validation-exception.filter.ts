import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

// Define types for the exception response
interface ValidationErrorResponse {
  statusCode: number;
  message: string | string[] | ValidationError[];
  error: string;
}

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void | Response {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse =
      exception.getResponse() as ValidationErrorResponse;

    // Check if this is a validation error with messages
    if (Array.isArray(exceptionResponse.message)) {
      const validationErrors: Record<string, string[]> = {};

      // If the errors come from class-validator (have property field)
      if (
        exceptionResponse.message.length > 0 &&
        typeof exceptionResponse.message[0] === 'object' &&
        'property' in exceptionResponse.message[0]
      ) {
        (exceptionResponse.message as ValidationError[]).forEach((error) => {
          if (error.constraints) {
            validationErrors[error.property] = Object.values(error.constraints);
          }
        });
      } else {
        // Group errors by field if possible
        (exceptionResponse.message as string[]).forEach((error: string) => {
          // Try to extract field name from error message
          const fieldMatch = error.match(/^([a-zA-Z0-9]+)/);
          const field = fieldMatch ? fieldMatch[1].toLowerCase() : 'general';

          if (!validationErrors[field]) {
            validationErrors[field] = [];
          }
          validationErrors[field].push(error);
        });
      }

      return response.status(status).json({
        statusCode: status,
        error: exceptionResponse.error || 'Bad Request',
        validationErrors,
      });
    }

    // If it's not a validation error, return the original response
    return response.status(status).json(exceptionResponse);
  }
}
