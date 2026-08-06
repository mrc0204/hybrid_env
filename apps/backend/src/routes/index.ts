import { Router } from "express";

/**
 * Versioned API router. Empty shell for now — feature routers (recommendations,
 * notifications, ...) mount here in later milestones. `/health` is deliberately
 * NOT under this router: it's an unversioned, infra-standard path that load
 * balancers and orchestrators expect to find at the root.
 */
export const apiRouter = Router();
