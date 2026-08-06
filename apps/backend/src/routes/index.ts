import { Router } from "express";

import { environmentRouter } from "./environment.route";

/**
 * Versioned API router. `/health` is deliberately NOT mounted here: it's an
 * unversioned, infra-standard path that load balancers and orchestrators
 * expect to find at the root.
 */
export const apiRouter = Router();

apiRouter.use("/environment", environmentRouter);
