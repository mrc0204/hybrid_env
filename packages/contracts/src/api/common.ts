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

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  service: ServiceName;
  version: string;
  timestamp: string;
}
