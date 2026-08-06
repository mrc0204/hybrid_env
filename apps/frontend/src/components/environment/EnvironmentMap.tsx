import type { GeoLocation, RiskState, WorldEntity } from "@ai-env/contracts";
import { motion } from "framer-motion";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

import { SEVERITY_HEX } from "@/lib/severity";
import { GAZETTEER } from "@/mock/scenarios";
import { useCognition } from "@/store/cognition";

import "leaflet/dist/leaflet.css";

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

  const center = storeCenter || GAZETTEER.Campus!;
  const risksVisible = activeStage >= 2;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
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
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />

        {/* Entities — the world as understood. */}
        {trace.worldState.entities.map((entity) => (
          <EntityMarker
            key={entity.id}
            entity={entity}
            isHighlighted={highlighted === entity.id}
            onHover={highlight}
          />
        ))}

        {/* Risks sit above entities and only appear once assessed, so the map
            tells the same temporal story as the spine. */}
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
