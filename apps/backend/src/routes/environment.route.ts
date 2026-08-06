import type { ApiResponse } from "@ai-env/contracts";
import { Router } from "express";

import { AppError } from "../errors/app-error";
import { environmentPipeline, type PipelineResult } from "../pipeline/environment.pipeline";

export const environmentRouter = Router();

/**
 * Manually trigger one pipeline cycle. The scheduler runs this on an interval
 * anyway; this exists so a demo can force a fresh cycle on command instead of
 * waiting for the next tick.
 */
environmentRouter.post("/refresh", async (_req, res, next) => {
  const result = await environmentPipeline.run("manual");

  if (result.status === "failed") {
    next(
      new AppError(503, "PIPELINE_FAILED", result.error ?? "Environment pipeline failed", {
        failedSources: result.failedSources,
      }),
    );
    return;
  }

  const body: ApiResponse<PipelineResult> = { success: true, data: result };
  res.json(body);
});
