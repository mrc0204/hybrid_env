import { PrismaClient } from "@prisma/client";

import { logger } from "../logging/logger";

/**
 * Single PrismaClient instance for the whole process. A plain
 * `new PrismaClient()` per import would open a new connection pool each time
 * a module re-imports this file (especially painful under tsx's watch-mode
 * reloads), so it's constructed once here and re-used everywhere.
 */
export const prisma = new PrismaClient();

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info("[db] connected to PostgreSQL");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("[db] disconnected from PostgreSQL");
}

/**
 * Live connectivity check used by the health endpoint. Deliberately does not
 * throw — callers get a boolean so a DB outage degrades the health status
 * instead of taking down the whole health check.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, "[db] connectivity check failed");
    return false;
  }
}
