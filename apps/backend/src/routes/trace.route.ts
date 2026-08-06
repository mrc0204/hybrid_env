import type { ApiResponse, ReasonTrace } from "@ai-env/contracts";
import { Router } from "express";

import { aiCoreClient } from "../clients/ai-core.client";

export const traceRouter = Router();

/**
 * GET /api/v1/trace/latest — thin proxy to the AI Core's own trace endpoint.
 * The Backend doesn't retain its own copy of the trace; the AI Core is the
 * source of truth for what it just reasoned about.
 */
traceRouter.get("/latest", async (_req, res, next) => {
  try {
    const trace = await aiCoreClient.getLatestTrace();
    const body: ApiResponse<ReasonTrace> = { success: true, data: trace };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
