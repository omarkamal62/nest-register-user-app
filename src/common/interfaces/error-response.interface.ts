export interface ValidationErrorResponse {
  statusCode: number;
  error: string;
  validationErrors: {
    [field: string]: string[];
  };
}
