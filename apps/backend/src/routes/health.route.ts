import type { ApiResponse, HealthStatus } from "@ai-env/contracts";
import { Router } from "express";

import { checkDatabaseConnection } from "../db/prisma";

const SERVICE_VERSION = "0.1.0";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const isDatabaseConnected = await checkDatabaseConnection();

  const body: ApiResponse<HealthStatus> = {
    success: true,
    data: {
      status: isDatabaseConnected ? "ok" : "degraded",
      service: "backend",
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    },
  };
  res.json(body);
});
