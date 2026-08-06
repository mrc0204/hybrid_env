import { AppError } from "../errors/app-error";
import { logger } from "../logging/logger";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Ordered by specificity. `!3d..!4d..` is the exact pin Google Maps embeds
 * for a shared place (most reliable); `@lat,lng` is the map's view center
 * (present on almost every maps.google.com URL, slightly less precise);
 * `q=`/`ll=` are older/alternate query-param forms.
 */
const COORD_PATTERNS: RegExp[] = [
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
];

function extractCoords(text: string): GeoPoint | null {
  for (const pattern of COORD_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const lat = parseFloat(match[1]!);
    const lng = parseFloat(match[2]!);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { lat, lng };
    }
  }
  return null;
}

const RESOLVE_TIMEOUT_MS = 8000;

/**
 * Extracts a lat/lng pin from a Google Maps URL — the fallback path when OSM
 * geocoding can't resolve a location by name. Full share links
 * (google.com/maps/...) carry coordinates directly; shortened links
 * (maps.app.goo.gl, goo.gl/maps) don't, and a browser can't read a
 * cross-origin redirect's final URL, so those are followed here, server-side.
 *
 * Never throws anything but AppError — the route only needs one shape to
 * catch, and a malformed/dead link should degrade to a clear message, never
 * an unhandled rejection (see organization.route.ts for why that matters).
 */
export async function resolveGoogleMapsLink(url: string): Promise<GeoPoint> {
  const direct = extractCoords(url);
  if (direct) return direct;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; agentic-environment-intelligence/1.0)",
      },
    });

    const fromFinalUrl = extractCoords(response.url);
    if (fromFinalUrl) return fromFinalUrl;

    // Some short links land on an interstitial that embeds coordinates in
    // the page body rather than the URL. Real coordinates appear early in
    // Maps' generated HTML, so only a prefix is worth scanning.
    const body = await response.text();
    const fromBody = extractCoords(body.slice(0, 20_000));
    if (fromBody) return fromBody;

    throw AppError.badRequest(
      "Could not find coordinates in that link. Open the pin in Google Maps, tap Share, and paste that link.",
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    const isAbort = err instanceof Error && err.name === "AbortError";
    logger.warn({ err, url }, "[maps-link] failed to resolve");
    throw new AppError(
      isAbort ? 504 : 502,
      isAbort ? "MAPS_LINK_TIMEOUT" : "MAPS_LINK_UNREACHABLE",
      isAbort
        ? "Timed out resolving that Google Maps link."
        : "Could not open that Google Maps link.",
    );
  } finally {
    clearTimeout(timer);
  }
}
