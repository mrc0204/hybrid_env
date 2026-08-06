import type { GeoLocation, RiskState, WorldEntity } from "@ai-env/contracts";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

import { cn } from "@/lib/utils";
import { SEVERITY_HEX } from "@/lib/severity";
import { GAZETTEER } from "@/mock/scenarios";
import { useCognition } from "@/store/cognition";

import "leaflet/dist/leaflet.css";

/**
 * Two ways of looking at the same place, and the toggle between them is the
 * point: the abstract basemap is the world *as the system models it*, the
 * satellite imagery is the world as it actually is. Neither replaces the
 * other — being able to check the model against reality is what makes the
 * model believable.
 *
 * Esri's World Imagery is used because it needs no API key, matching the
 * project's "works on a fresh clone" constraint.
 */
const BASEMAPS = {
  abstract: {
    label: "Map",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    label: "Satellite",
    // Esri serves this tile scheme as {z}/{y}/{x} — not the usual {z}/{x}/{y}.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
} as const;

type BasemapId = keyof typeof BASEMAPS;

/**
 * `location` in the contracts is `GeoLocation | string` — the Backend sends a
 * human label ("South Gate") while richer sources send coordinates. Both are
 * resolved here so the map works against live and mock data alike.
 */
function resolveLocation(location: GeoLocation | string | undefined): GeoLocation | null {
  if (!location) return null;
  if (typeof location === "string") return GAZETTEER[location] ?? null;
  return location;
}

export function EnvironmentMap() {
  const trace = useCognition((s) => s.trace);
  const highlighted = useCognition((s) => s.highlightedRefId);
  const highlight = useCognition((s) => s.highlight);
  const activeStage = useCognition((s) => s.activeStage);
  const storeCenter = useCognition((s) => s.mapCenter);

  const [basemap, setBasemap] = useState<BasemapId>("abstract");

  const center = storeCenter || GAZETTEER.Campus!;
  const risksVisible = activeStage >= 2;
  const routeVisible = activeStage >= 3;
  const tiles = BASEMAPS[basemap];

  // The router returns its path as entity *labels*, since that is what reads
  // in the trace. Turning it back into a drawable line means matching those
  // labels to the entities they came from. Any hop that can't be resolved to
  // a coordinate is dropped rather than guessed at — a route line is a claim
  // about real geography, and inventing a vertex would make it a false one.
  const routeLine = useMemo(() => {
    const chosen = trace.simulations.find(
      (s) => s.id === trace.decision.chosenSimulationResultId,
    );
    if (!chosen?.routePath?.length) return [];

    const byLabel = new Map<string, GeoLocation>();
    for (const entity of trace.worldState.entities) {
      const point = resolveLocation(entity.location);
      if (point && entity.label && !byLabel.has(entity.label)) byLabel.set(entity.label, point);
    }

    return chosen.routePath
      .map((label) => byLabel.get(label))
      .filter((p): p is GeoLocation => Boolean(p))
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [trace]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl" data-basemap={basemap}>
      <BasemapToggle active={basemap} onChange={setBasemap} />
      <MapContainer
        key={`${center.lat}-${center.lng}`}
        center={[center.lat, center.lng]}
        zoom={16}
        zoomControl={false}
        attributionControl
        scrollWheelZoom={false}
        dragging={true}
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Keyed so Leaflet swaps the tile source instead of trying to
            reconcile two different tile schemes in place. */}
        <TileLayer key={basemap} url={tiles.url} attribution={tiles.attribution} />

        {/* Entities — the world as understood. */}
        {trace.worldState.entities.map((entity) => (
          <EntityMarker
            key={entity.id}
            entity={entity}
            isHighlighted={highlighted === entity.id}
            onHover={highlight}
          />
        ))}

        {/* Risk fields render beneath their markers: the marker says "a risk
            was detected here", the field says "and this is roughly how far it
            reaches". Both appear only once assessed, so the map tells the same
            temporal story as the spine. */}
        {risksVisible &&
          trace.risks.map((risk) => (
            <RiskField key={`f-${risk.id}`} risk={risk} fallback={center} />
          ))}

        {/* The chosen route, drawn once the simulation stage is reached. Seeing
            it bend around the risk fields is the whole argument that the router
            is reacting to the world model rather than ignoring it. */}
        {routeVisible && routeLine.length > 1 && <RouteLine points={routeLine} />}

        {risksVisible &&
          trace.risks.map((risk) => (
            <RiskMarker
              key={risk.id}
              risk={risk}
              isHighlighted={highlighted === risk.id}
              onHover={highlight}
            />
          ))}
      </MapContainer>

      {/* Scrim keeps the map subordinate to the panels above it. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-void/30" />

      <div className="pointer-events-none absolute left-4 top-3.5">
        <span className="eyebrow">{trace.worldState.scope}</span>
      </div>
    </div>
  );
}

/**
 * Roughly how far each severity's influence is treated as reaching, in metres.
 * These are presentational — the reasoning engine models risk as attached to
 * entities, not as a measured radius — so the field is drawn as a soft
 * gradient with no hard edge, which is the honest way to render a boundary
 * the system does not actually claim to know.
 */
const RISK_FIELD_RADIUS_M: Record<string, number> = {
  critical: 330,
  high: 260,
  medium: 190,
  low: 130,
};

/** Concentric bands, outermost first: each is faint, and they sum to a falloff. */
const FIELD_BANDS = [
  { scale: 1.0, opacity: 0.05 },
  { scale: 0.72, opacity: 0.07 },
  { scale: 0.48, opacity: 0.09 },
  { scale: 0.26, opacity: 0.13 },
];

/**
 * A risk rendered as a spatial field rather than a pin. A single dot says
 * "something is wrong here"; a gradient says "this is the shape of it", which
 * is the difference between a map with markers on it and a map that shows a
 * world model.
 */
function RiskField({ risk, fallback }: { risk: RiskState; fallback: GeoLocation }) {
  // Weather and traffic risks carry the organization's *label* as their
  // location, because that is what the provider was queried for. Falling back
  // to the organization's centre is not a guess in that case — it is the
  // coordinate the reading was actually taken at.
  const point = resolveLocation(risk.location) ?? fallback;

  const color = SEVERITY_HEX[risk.severity] ?? SEVERITY_HEX.medium;
  const base = RISK_FIELD_RADIUS_M[risk.severity] ?? RISK_FIELD_RADIUS_M.medium!;

  return (
    <>
      {FIELD_BANDS.map((band) => (
        <Circle
          key={band.scale}
          center={[point.lat, point.lng]}
          radius={base * band.scale}
          // Radius is geographic, so the field keeps its real extent as the
          // map zooms — unlike the markers, which are a fixed pixel size.
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: band.opacity,
            opacity: 0,
            stroke: false,
          }}
          interactive={false}
        />
      ))}
    </>
  );
}

/**
 * The chosen path, drawn as a casing plus a bright core so it stays readable
 * over both the dark basemap and satellite imagery.
 */
function RouteLine({ points }: { points: [number, number][] }) {
  return (
    <>
      <Polyline
        positions={points}
        pathOptions={{ color: "#05070d", weight: 7, opacity: 0.55 }}
        interactive={false}
      />
      <Polyline
        positions={points}
        pathOptions={{ color: "#8B9CFF", weight: 2.5, opacity: 0.95, dashArray: "1 7" }}
        interactive={false}
      />
      {points.map((p, i) => (
        <CircleMarker
          key={`${p[0]}-${p[1]}-${i}`}
          center={p}
          radius={2.5}
          pathOptions={{ color: "#8B9CFF", fillColor: "#8B9CFF", fillOpacity: 1, weight: 0 }}
          interactive={false}
        />
      ))}
    </>
  );
}

/**
 * Sits above Leaflet's own stacking context (z-[1000]) — panes and tile
 * layers otherwise render over anything positioned inside the map container.
 */
function BasemapToggle({
  active,
  onChange,
}: {
  active: BasemapId;
  onChange: (id: BasemapId) => void;
}) {
  return (
    <div
      className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-lg border border-line bg-void/80 backdrop-blur-md"
      role="group"
      aria-label="Basemap"
    >
      {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={cn(
            "px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors duration-200",
            active === id
              ? "bg-cognition/15 text-cognition"
              : "text-ink-ghost hover:text-ink-faint",
          )}
        >
          {BASEMAPS[id].label}
        </button>
      ))}
    </div>
  );
}

function EntityMarker({
  entity,
  isHighlighted,
  onHover,
}: {
  entity: WorldEntity;
  isHighlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  const loc = resolveLocation(entity.location);
  if (!loc) return null;

  return (
    <CircleMarker
      center={[loc.lat, loc.lng]}
      radius={isHighlighted ? 8 : 5}
      pathOptions={{
        color: isHighlighted ? "#A9B6FF" : "#8B9CFF",
        fillColor: "#8B9CFF",
        fillOpacity: isHighlighted ? 0.55 : 0.22,
        weight: isHighlighted ? 2 : 1,
      }}
      eventHandlers={{
        mouseover: () => onHover(entity.id),
        mouseout: () => onHover(null),
      }}
    >
      <Tooltip direction="top" offset={[0, -6]} opacity={1}>
        <span style={{ fontSize: 11 }}>{entity.label}</span>
      </Tooltip>
    </CircleMarker>
  );
}

function RiskMarker({
  risk,
  isHighlighted,
  onHover,
}: {
  risk: RiskState;
  isHighlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  const loc = resolveLocation(risk.location);
  if (!loc) return null;
  const color = SEVERITY_HEX[risk.severity];

  return (
    <CircleMarker
      center={[loc.lat, loc.lng]}
      radius={isHighlighted ? 18 : 13}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: isHighlighted ? 0.3 : 0.14,
        weight: isHighlighted ? 2 : 1,
      }}
      eventHandlers={{
        mouseover: () => onHover(risk.id),
        mouseout: () => onHover(null),
      }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <span style={{ fontSize: 11 }}>
          {risk.riskType} · {risk.severity}
        </span>
      </Tooltip>
    </CircleMarker>
  );
}

/** Small legend so severity colour is decodable without hovering. */
export function MapLegend() {
  const risks = useCognition((s) => s.trace.risks);
  const severities = Array.from(new Set(risks.map((r) => r.severity)));

  if (severities.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute bottom-3 left-4 flex items-center gap-3"
    >
      {severities.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_HEX[s] }} />
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{s}</span>
        </div>
      ))}
    </motion.div>
  );
}
