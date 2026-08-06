import { AppError } from "../errors/app-error";
import { logger } from "../logging/logger";

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs: number;
  /** Number of *retries* after the initial attempt. 0 means try once. */
  maxRetries?: number;
  label: string;
}

/**
 * Transient failures are worth retrying; deterministic ones are not. Retrying
 * a 400 just burns the timeout budget and delays the inevitable, so only
 * network errors, timeouts, 5xx, and 429 are retried.
 */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function backoffMs(attempt: number): number {
  // 200ms, 400ms, 800ms — bounded, since a request already has its own timeout.
  return 200 * 2 ** attempt;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with a hard timeout and bounded retries, returning parsed JSON.
 *
 * Always throws `AppError` (never a raw fetch/abort error) so callers have a
 * single, typed failure shape to handle. Callers are still responsible for
 * deciding whether a failure is fatal — nothing here escapes to crash the
 * process.
 */
export async function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  const { method = "GET", body, timeoutMs, maxRetries = 0, label } = options;
  let lastError: AppError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new AppError(
          502,
          "UPSTREAM_ERROR",
          `${label} responded with ${response.status}`,
        );
        if (!isRetryableStatus(response.status) || attempt === maxRetries) throw error;
        lastError = error;
      } else {
        return (await response.json()) as T;
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              504,
              isAbort ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE",
              isAbort
                ? `${label} timed out after ${timeoutMs}ms`
                : `${label} unreachable: ${err instanceof Error ? err.message : "unknown error"}`,
            );

      // A non-retryable upstream status already exhausted its chances above.
      if (appError.code === "UPSTREAM_ERROR" && !lastError) throw appError;
      if (attempt === maxRetries) throw appError;
      lastError = appError;
    } finally {
      clearTimeout(timer);
    }

    const wait = backoffMs(attempt);
    logger.warn(
      { label, attempt: attempt + 1, retryInMs: wait, reason: lastError?.message },
      "[http] retrying upstream request",
    );
    await delay(wait);
  }

  throw lastError ?? AppError.internal(`${label} failed`);
}
