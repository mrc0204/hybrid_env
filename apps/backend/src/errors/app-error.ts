/**
 * The one error type route handlers and services should throw. Carries
 * everything the centralized error handler needs to produce a correct
 * ApiResponse envelope without inspecting the error message.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static notFound(message = "Resource not found", details?: unknown): AppError {
    return new AppError(404, "NOT_FOUND", message, details);
  }

  static badRequest(message = "Invalid request", details?: unknown): AppError {
    return new AppError(400, "BAD_REQUEST", message, details);
  }

  static internal(message = "Internal server error", details?: unknown): AppError {
    return new AppError(500, "INTERNAL_ERROR", message, details);
  }
}
