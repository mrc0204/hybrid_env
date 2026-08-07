import { createServer } from "node:http";

import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./db/prisma";
import { logger } from "./logging/logger";
import { startEnvironmentScheduler } from "./pipeline/environment.pipeline";
import { initSocketServer } from "./realtime/socket";

/**
 * Last line of defence for the process itself. Node's default on an unhandled
 * rejection (and, effectively, an uncaught exception) is to terminate — which
 * is exactly the "backend dies after a search" symptom when any async path
 * anywhere throws without a local catch. A demo API is far better off logging
 * the fault and staying up to serve the next request than exiting.
 *
 * Note this cannot catch an out-of-memory kill: that is a SIGKILL from the
 * container and is uncatchable in-process. If the crash persists with these
 * handlers installed, the cause is memory, not a stray exception.
 */
function installProcessGuards(): void {
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "[process] unhandled promise rejection — kept alive");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "[process] uncaught exception — kept alive");
  });
}

async function main(): Promise<void> {
  installProcessGuards();

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

  const stopScheduler = startEnvironmentScheduler();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[backend] received ${signal}, shutting down`);
    stopScheduler();
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
