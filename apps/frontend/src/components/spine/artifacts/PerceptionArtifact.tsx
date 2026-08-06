import type { InputEvent } from "@ai-env/contracts";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  "input.weather.updated": "Weather",
  "input.traffic.updated": "Traffic",
  "input.announcement.created": "Announcement",
  "input.user.context_changed": "User context",
  "input.organization.context_updated": "Organization",
};

/**
 * Raw signals as they arrive. Rendered as a stream rather than a table:
 * signals are events in time, and a table would imply they are records.
 */
export function PerceptionArtifact({ events }: { events: InputEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-lg border border-line-subtle bg-surface px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-cognition" />
              <span className="text-[12px] font-medium text-ink">
                {SOURCE_LABEL[event.type] ?? event.type}
              </span>
            </div>
            <span className="numeric text-micro text-ink-ghost">{formatTime(event.timestamp)}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <SignalDetails event={event} />
          </div>

          <div className="mt-2 font-mono text-[10px] text-ink-ghost">via {event.source}</div>
        </motion.div>
      ))}
    </div>
  );
}

function SignalDetails({ event }: { event: InputEvent }) {
  if (event.type === "input.weather.updated") {
    const p = event.payload;
    return (
      <>
        <Badge tone="cognition">{p.condition.replace(/_/g, " ")}</Badge>
        <Badge>{p.temperatureC}°C</Badge>
        <Badge>{p.precipitationMm}mm</Badge>
        <Badge>{p.windKph} km/h</Badge>
        {p.humidityPercent !== undefined && <Badge>{p.humidityPercent}% RH</Badge>}
      </>
    );
  }

  if (event.type === "input.traffic.updated") {
    const p = event.payload;
    return (
      <>
        <Badge
          tone={
            p.congestionLevel === "high"
              ? "high"
              : p.congestionLevel === "medium"
                ? "medium"
                : "low"
          }
        >
          {p.congestionLevel}
        </Badge>
        {p.averageSpeedKph !== undefined && <Badge>{p.averageSpeedKph} km/h</Badge>}
        {p.travelTimeMinutes !== undefined && <Badge>{p.travelTimeMinutes} min</Badge>}
        {p.routeStatus && (
          <Badge tone={p.routeStatus === "closed" ? "critical" : "neutral"}>{p.routeStatus}</Badge>
        )}
      </>
    );
  }

  if (event.type === "input.announcement.created") {
    return (
      <span className="text-[12px] leading-relaxed text-ink-muted">{event.payload.title}</span>
    );
  }

  if (event.type === "input.organization.context_updated") {
    const p = event.payload;
    return (
      <>
        <Badge tone="cognition">{p.entities.length} entities</Badge>
        <Badge tone={p.source === "live" ? "low" : p.source === "cache" ? "neutral" : "medium"}>
          {p.source}
        </Badge>
        <span className="text-[12px] leading-relaxed text-ink-muted">{p.resolvedName}</span>
      </>
    );
  }

  return <Badge>{event.payload.userContext.userId}</Badge>;
}
