import type { ApiResponse, DependencyStatus, HealthStatus } from "@ai-env/contracts";
import { Router } from "express";

import { aiCoreClient } from "../clients/ai-core.client";
import { checkDatabaseConnection } from "../db/prisma";

const SERVICE_VERSION = "0.1.0";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  // Probed concurrently — health checks shouldn't take the sum of every
  // dependency's timeout.
  const [isDatabaseConnected, aiCoreStatus] = await Promise.all([
    checkDatabaseConnection(),
    aiCoreClient.checkHealth(),
  ]);

  const dependencies: Record<string, DependencyStatus> = {
    database: isDatabaseConnected ? "ok" : "down",
    aiCore: aiCoreStatus,
  };

  // The Backend itself is up; a failing dependency makes it degraded, not down.
  const allHealthy = Object.values(dependencies).every((status) => status === "ok");

  const body: ApiResponse<HealthStatus> = {
    success: true,
    data: {
      status: allHealthy ? "ok" : "degraded",
      service: "backend",
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      dependencies,
    },
  };
  res.json(body);
});
