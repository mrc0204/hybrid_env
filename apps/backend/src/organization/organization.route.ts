import type { ApiResponse } from "@ai-env/contracts";
import { Router } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error";
import { environmentPipeline } from "../pipeline/environment.pipeline";
import { organizationService } from "./organization.service";
import type { OrganizationDiscoveryResponse } from "./types";

export const organizationRouter = Router();

const DiscoverBodySchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  center: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  boundingBox: z.object({
    south: z.number(),
    west: z.number(),
    north: z.number(),
    east: z.number(),
  }).optional(),
});

/**
 * POST /api/v1/organization/discover — the target user flow's entry point:
 * user provides an organization name, the system discovers its physical
 * environment, combines it with live weather/traffic at its location, and
 * returns a personalized recommendation.
 *
 * Supports passing geocoded center and boundingBox parameters directly from
 * the frontend's autocomplete selections to bypass rate-limited geocoding APIs on the backend.
 */
organizationRouter.post("/discover", async (req, res, next) => {
  const parsed = DiscoverBodySchema.safeParse(req.body);
  if (!parsed.success) {
    next(AppError.badRequest("Invalid request body", parsed.error.issues));
    return;
  }

  const discovery = await organizationService.discover(
    parsed.data.name,
    parsed.data.center,
    parsed.data.boundingBox,
  );
  const pipelineResult = await environmentPipeline.runForOrganization(discovery);

  const body: ApiResponse<OrganizationDiscoveryResponse> = {
    success: true,
    data: {
      organization: discovery.profile,
      source: discovery.source,
      entityCount: discovery.entities.length,
      pipeline: {
        status: pipelineResult.status,
        recommendation: pipelineResult.recommendation,
        error: pipelineResult.error,
      },
    },
  };
  res.json(body);
});
