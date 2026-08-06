import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}
