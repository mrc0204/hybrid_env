import type { ApiResponse } from "@ai-env/contracts";
import { Router } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error";
import { environmentPipeline } from "../pipeline/environment.pipeline";
import { resolveGoogleMapsLink, type GeoPoint } from "./maps-link";
import { organizationService } from "./organization.service";
import type { OrganizationDiscoveryResponse } from "./types";

export const organizationRouter = Router();

const DiscoverBodySchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  center: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  boundingBox: z
    .object({
      south: z.number(),
      west: z.number(),
      north: z.number(),
      east: z.number(),
    })
    .optional(),
});

const ResolveMapsLinkSchema = z.object({
  url: z.string().trim().url("Must be a valid URL"),
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

  // Express 4 does not forward rejected async-handler promises to `next()`
  // automatically (that's an Express 5 feature) — without this try/catch,
  // organizationService.discover()'s AppError.notFound() for an unresolvable
  // location becomes an unhandled rejection, which crashes the whole process
  // under Node's default unhandled-rejection behavior.
  try {
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
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/organization/resolve-maps-link — the fallback when discovery
 * by name fails (OSM has no match). The user pastes a Google Maps link
 * instead; this extracts a lat/lng pin from it, which the frontend then
 * retries `/discover` with, bypassing name-based geocoding entirely.
 */
organizationRouter.post("/resolve-maps-link", async (req, res, next) => {
  const parsed = ResolveMapsLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    next(AppError.badRequest("Invalid request body", parsed.error.issues));
    return;
  }

  try {
    const center = await resolveGoogleMapsLink(parsed.data.url);
    const body: ApiResponse<{ center: GeoPoint }> = { success: true, data: { center } };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
