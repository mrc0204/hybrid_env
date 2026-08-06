import type { GeoLocation, RiskState, WorldEntity } from "@ai-env/contracts";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

import { cn } from "@/lib/utils";
import { SEVERITY_HEX } from "@/lib/severity";
import { GAZETTEER } from "@/mock/scenarios";
import { useCognition } from "@/store/cognition";

import "leaflet/dist/leaflet.css";

const BASEMAPS = {
  abstract: {
    label: "Map",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
} as const;

type BasemapId = keyof typeof BASEMAPS;

function resolveLocation(location: GeoLocation | string | undefined): GeoLocation | null {
  if (!location) return null;
  if (typeof location === "string") return GAZETTEER[location] ?? null;
  if (typeof location === "object" && typeof location.lat === "number" && typeof location.lng === "number") {
    return location;
  }
  return null;
}

/**
 * Subcomponent to dynamically re-fit Leaflet map bounds whenever the route
 * line or risk points change.
 */
function MapBoundsFitter({
  center,
  routePoints,
  riskPoints,
}: {
  center: GeoLocation;
  routePoints: [number, number][];
  riskPoints: GeoLocation[];
}) {
  const map = useMap();

  useEffect(() => {
    const allCoords: [number, number][] = [];

    if (routePoints.length > 0) {
      routePoints.forEach((pt) => allCoords.push(pt));
    }
    if (riskPoints.length > 0) {
      riskPoints.forEach((r) => allCoords.push([r.lat, r.lng]));
    }
    if (allCoords.length === 0 && center) {
      allCoords.push([center.lat, center.lng]);
    }

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: true });
    }
  }, [map, center, routePoints, riskPoints]);

  return null;
}

export function EnvironmentMap() {
  const trace = useCognition((s) => s.trace);
  const highlighted = useCognition((s) => s.highlightedRefId);
  const highlight = useCognition((s) => s.highlight);
  const activeStage = useCognition((s) => s.activeStage);
  const storeCenter = useCognition((s) => s.mapCenter);

  const [basemap, setBasemap] = useState<BasemapId>("abstract");

  const center = storeCenter || GAZETTEER.Campus!;

  // CRITICAL FIX: activeStage is 5 when a discovery trace is loaded / completed.
  // Both risks and route must be visible when idle (-1) or when at stage >= 2 / 3.
  const risksVisible = activeStage === -1 || activeStage >= 2;
  const routeVisible = activeStage === -1 || activeStage >= 3;
  const tiles = BASEMAPS[basemap];

  // Resolve Dijkstra route hop labels to [lat, lng] coordinates with robust case/trim matching
  const routeLine = useMemo(() => {
    const chosen = trace.simulations.find(
      (s) => s.id === trace.decision.chosenSimulationResultId,
    );
    if (!chosen?.routePath?.length) return [];

    const byKey = new Map<string, GeoLocation>();
    for (const entity of trace.worldState.entities) {
      const point = resolveLocation(entity.location);
      if (point) {
        if (entity.label) byKey.set(entity.label.trim().toLowerCase(), point);
        if (entity.id) byKey.set(entity.id.trim().toLowerCase(), point);
      }
    }

    return chosen.routePath
      .map((label) => byKey.get((label || "").trim().toLowerCase()))
      .filter((p): p is GeoLocation => Boolean(p))
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [trace]);

  // Extract risk locations for bounds fitter
  const riskPoints = useMemo(() => {
    return trace.risks
      .map((r) => resolveLocation(r.location) ?? center)
      .filter((p): p is GeoLocation => Boolean(p));
  }, [trace.risks, center]);

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
        <TileLayer key={basemap} url={tiles.url} attribution={tiles.attribution} />
        <MapBoundsFitter center={center} routePoints={routeLine} riskPoints={riskPoints} />

        {/* Entities */}
        {trace.worldState.entities.map((entity) => (
          <EntityMarker
            key={entity.id}
            entity={entity}
            isHighlighted={highlighted === entity.id}
            onHover={highlight}
          />
        ))}

        {/* Operational Risk Heatmap Fields */}
        {risksVisible &&
          trace.risks.map((risk) => (
            <RiskField key={`f-${risk.id}`} risk={risk} fallback={center} />
          ))}

        {/* Chosen Dijkstra Route Polyline */}
        {routeVisible && routeLine.length > 1 && <RouteLine points={routeLine} />}

        {/* Risk Markers */}
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

      {/* Scrim keeps map subordinate */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-void/30" />

      <div className="pointer-events-none absolute left-4 top-3.5">
        <span className="eyebrow">{trace.worldState.scope}</span>
      </div>
    </div>
  );
}

const RISK_FIELD_RADIUS_M: Record<string, number> = {
  critical: 330,
  high: 260,
  medium: 190,
  low: 130,
};

// Vibrant heatmap field bands for unmistakable visibility
const FIELD_BANDS = [
  { scale: 1.0, opacity: 0.18 },
  { scale: 0.72, opacity: 0.28 },
  { scale: 0.48, opacity: 0.38 },
  { scale: 0.26, opacity: 0.50 },
];

function RiskField({ risk, fallback }: { risk: RiskState; fallback: GeoLocation }) {
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
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: band.opacity,
            opacity: 0.4,
            weight: 1,
            stroke: true,
          }}
          interactive={false}
        />
      ))}
    </>
  );
}

function RouteLine({ points }: { points: [number, number][] }) {
  return (
    <>
      {/* Casing line */}
      <Polyline
        positions={points}
        pathOptions={{ color: "#05070d", weight: 8, opacity: 0.75 }}
        interactive={false}
      />
      {/* Bright glowing core polyline */}
      <Polyline
        positions={points}
        pathOptions={{ color: "#7B8DFF", weight: 4.5, opacity: 0.95 }}
        interactive={false}
      />
      {/* Node waypoint circles */}
      {points.map((p, i) => (
        <CircleMarker
          key={`${p[0]}-${p[1]}-${i}`}
          center={p}
          radius={4.5}
          pathOptions={{ color: "#ffffff", fillColor: "#7B8DFF", fillOpacity: 1, weight: 1.5 }}
          interactive={false}
        />
      ))}
    </>
  );
}

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
            "px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors duration-200",
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{s}</span>
        </div>
      ))}
    </motion.div>
  );
}
