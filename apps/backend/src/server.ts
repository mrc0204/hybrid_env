import { createServer } from "node:http";

import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./db/prisma";
import { logger } from "./logging/logger";
import { initSocketServer } from "./realtime/socket";

async function main(): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  // Connection is attempted but not blocking: the health endpoint reports
  // "degraded" (not "down") if the database is unreachable, so a transient
  // outage doesn't take the whole process down with it.
  try {
    await connectDatabase();
  } catch (err) {
    logger.warn({ err }, "[db] initial connection failed — starting in degraded mode");
  }

  httpServer.listen(env.PORT, () => {
    logger.info(`[backend] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[backend] received ${signal}, shutting down`);
    httpServer.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  logger.error({ err }, "[backend] fatal error during startup");
  process.exit(1);
});
