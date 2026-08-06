/**
 * Every JSON response returned by Backend or AI Core HTTP endpoints uses this
 * envelope, so clients can branch on `success` without inspecting status codes.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiError {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ServiceName = "backend" | "ai-core";

export type DependencyStatus = "ok" | "degraded" | "down";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  service: ServiceName;
  version: string;
  timestamp: string;
  /**
   * Health of downstream dependencies this service needs (database, AI Core,
   * ...). A service reports "degraded" — not "down" — when it is itself
   * running but a dependency is unavailable.
   */
  dependencies?: Record<string, DependencyStatus>;
}
