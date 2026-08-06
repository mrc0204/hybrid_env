import type { ApiResponse } from "@ai-env/contracts";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error";
import { logger } from "../logging/logger";

/**
 * Final middleware in the pipeline. Translates any thrown error into the
 * shared ApiResponse envelope so clients never have to branch on whether a
 * given endpoint happens to fail differently than another.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifies error middleware by arity (4 params).
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const appError = err instanceof AppError ? err : AppError.internal(toMessage(err));

  if (appError.statusCode >= 500) {
    logger.error({ err, path: req.originalUrl }, appError.message);
  } else {
    logger.warn({ path: req.originalUrl, code: appError.code }, appError.message);
  }

  const body: ApiResponse<never> = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
  };
  res.status(appError.statusCode).json(body);
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}
