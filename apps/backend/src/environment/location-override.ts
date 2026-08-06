/**
 * Optional per-call location, used when environment data is being collected
 * for a dynamically discovered organization rather than the static
 * ENVIRONMENT_LATITUDE/LONGITUDE/LOCATION_NAME configured for the default
 * deployment. Absent means "use the configured default" everywhere it's
 * threaded through.
 */
export interface LocationOverride {
  lat: number;
  lng: number;
  label: string;
}
