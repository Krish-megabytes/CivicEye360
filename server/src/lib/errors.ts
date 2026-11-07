export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'The request could not be processed.', details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'You need to sign in to continue.') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'The requested resource was not found.') =>
  new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message = 'The request conflicts with the current state.', details?: unknown) =>
  new ApiError(409, 'CONFLICT', message, details);
export const unprocessable = (message = 'Validation failed.', details?: unknown) =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);
export const tooManyRequests = (message = 'Too many requests. Please try again later.') =>
  new ApiError(429, 'RATE_LIMITED', message);
