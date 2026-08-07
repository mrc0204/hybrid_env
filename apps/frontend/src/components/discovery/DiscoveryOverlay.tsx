import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import type { Recommendation } from "@ai-env/contracts";
import { resolveMapsLink } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  DISCOVERY_STAGES,
  useDiscoveryStore,
  type DiscoveryPhase,
  type StageMetrics,
} from "@/store/discoveryStore";
import { useCognition } from "@/store/cognition";

type DiscoverFn = (
  orgName: string,
  center?: { lat: number; lng: number },
  boundingBox?: { south: number; west: number; north: number; east: number },
) => void;

interface DiscoveryOverlayProps {
  onCancel: () => void;
  onDismiss: () => void;
  /**
   * Retries discovery with an explicit center — used by the maps-link
   * fallback in FailurePanel to bypass name-based geocoding entirely once
   * OSM has already failed to resolve a location.
   */
  onDiscover: DiscoverFn;
}

/**
 * Full-screen discovery overlay.
 *
 * Lifecycle states driven by the Zustand store:
 *   running  → stage list with live animation and live metrics
 *   success  → success panel (auto-dismisses after 3.5 s)
 *   failed   → error panel below partial stage list
 *
 * The component is mounted in App.tsx inside <AnimatePresence> so the entry
 * and exit transitions are handled at that level. The overlay only needs its
 * own internal AnimatePresence for the success/failure swap.
 */
export function DiscoveryOverlay({ onCancel, onDismiss, onDiscover }: DiscoveryOverlayProps) {
  const phase = useDiscoveryStore((s) => s.phase);
  const orgName = useDiscoveryStore((s) => s.orgName);
  const currentStage = useDiscoveryStore((s) => s.currentStage);
  const completedStages = useDiscoveryStore((s) => s.completedStages);
  const metrics = useDiscoveryStore((s) => s.metrics);
  const recommendation = useDiscoveryStore((s) => s.recommendation);
  const error = useDiscoveryStore((s) => s.error);
  const startedAt = useDiscoveryStore((s) => s.startedAt);

  const elapsed = useElapsed(startedAt, phase === "running");

  // ESC key listener to dismiss overlay cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "running") {
          onCancel();
        } else {
          onDismiss();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, onCancel, onDismiss]);

  // Auto-dismiss on success after a short read window.
  useEffect(() => {
    if (phase !== "success") return;
    const t = window.setTimeout(() => {
      onDismiss();
    }, 2_500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-void/92 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Grain overlay to match the ambient field's texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-[420px] px-8 pb-16 pt-[13vh]">
        <AnimatePresence mode="wait">
          {phase === "success" && recommendation ? (
            <SuccessPanel
              key="success"
              orgName={orgName}
              recommendation={recommendation}
              onDismiss={onDismiss}
            />
          ) : (
            <motion.div key="stages" initial={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
              {/* ── Header ─────────────────────────────────────────────────── */}
              <DiscoveryHeader orgName={orgName} phase={phase} elapsed={elapsed} />

              {/* ── Stage list ─────────────────────────────────────────────── */}
              <div className="mt-10">
                <DiscoveryStageList
                  currentStage={currentStage}
                  completedStages={completedStages}
                  metrics={metrics}
                  phase={phase}
                />
              </div>

              {/* ── Error panel ────────────────────────────────────────────── */}
              <AnimatePresence>
                {phase === "failed" && error && (
                  <FailurePanel
                    key="error"
                    error={error}
                    orgName={orgName}
                    onDismiss={onDismiss}
                    onDiscover={onDiscover}
                  />
                )}
              </AnimatePresence>

              {/* ── Footer: cancel ─────────────────────────────────────────── */}
              <AnimatePresence>
                {phase === "running" && (
                  <motion.div
                    key="cancel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-10 flex justify-end"
                  >
                    <button
                      onClick={onCancel}
                      className="font-mono text-[10px] uppercase tracking-widest text-ink-ghost transition-colors duration-200 hover:text-ink-faint"
                    >
                      Cancel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DiscoveryHeader({
  orgName,
  phase,
  elapsed,
}: {
  orgName: string;
  phase: DiscoveryPhase;
  elapsed: string | null;
}) {
  const phaseLabel: Record<DiscoveryPhase, string> = {
    idle: "",
    running: "Discovering",
    success: "Complete",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{phaseLabel[phase]}</span>
        {elapsed && (
          <span className="font-mono text-[10px] tabular-nums text-ink-ghost">{elapsed}</span>
        )}
      </div>
      <motion.h2
        className="mt-1 text-[22px] font-light leading-tight tracking-[-0.02em] text-ink"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {orgName}
      </motion.h2>
    </div>
  );
}

interface DiscoveryStageListProps {
  currentStage: number;
  completedStages: number[];
  metrics: StageMetrics;
  phase: DiscoveryPhase;
}

function DiscoveryStageList({
  currentStage,
  completedStages,
  metrics,
  phase,
}: DiscoveryStageListProps) {
  return (
    <div className="relative flex flex-col gap-0">
      {DISCOVERY_STAGES.map((stage, index) => {
        const isDone = completedStages.includes(index);
        const isActive = currentStage === index && phase === "running";
        const isPending = !isDone && !isActive;
        const isLast = index === DISCOVERY_STAGES.length - 1;
        const metric = metrics[stage.id];

        return (
          <DiscoveryStageRow
            key={stage.id}
            label={stage.label}
            metric={metric}
            isDone={isDone}
            isActive={isActive}
            isPending={isPending}
            isLast={isLast}
          />
        );
      })}
    </div>
  );
}

interface DiscoveryStageRowProps {
  label: string;
  metric: string | undefined;
  isDone: boolean;
  isActive: boolean;
  isPending: boolean;
  isLast: boolean;
}

function DiscoveryStageRow({
  label,
  metric,
  isDone,
  isActive,
  isPending,
  isLast,
}: DiscoveryStageRowProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Rail column: marker + connector */}
      <div className="relative flex w-4 shrink-0 flex-col items-center">
        <StageDot isDone={isDone} isActive={isActive} isPending={isPending} />

        {!isLast && (
          <div className="relative mt-1 h-8 w-px overflow-hidden bg-line">
            <motion.div
              className="absolute inset-x-0 top-0 bg-cognition"
              initial={{ height: "0%" }}
              animate={{ height: isDone ? "100%" : "0%" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>

      {/* Text column: label + metric */}
      <div className="min-w-0 flex-1 pb-1 pt-[1px]">
        <span
          className={cn(
            "text-[12px] leading-snug transition-colors duration-500",
            isActive && "text-ink",
            isDone && "text-ink-faint",
            isPending && "text-ink-ghost",
          )}
        >
          {label}
        </span>

        {/* Metric fades in after the stage completes and data is available */}
        <AnimatePresence>
          {isDone && metric && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mt-[2px] font-mono text-[9.5px] text-cognition/65"
            >
              {metric}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StageDot({
  isDone,
  isActive,
  isPending,
}: {
  isDone: boolean;
  isActive: boolean;
  isPending: boolean;
}) {
  return (
    <div className="relative flex h-4 w-4 items-center justify-center">
      {/* Breathing halo — only on the active stage */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full bg-cognition/20"
          animate={{ scale: [1, 1.9, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.div
        className={cn(
          "relative rounded-full border transition-colors duration-400",
          isDone && "h-2 w-2 border-cognition bg-cognition",
          isActive && "h-2.5 w-2.5 border-cognition bg-cognition",
          isPending && "h-2 w-2 border-line-strong bg-transparent",
        )}
        animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{
          duration: 1.8,
          repeat: isActive ? Infinity : 0,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

function SuccessPanel({
  orgName,
  recommendation,
  onDismiss,
}: {
  orgName: string;
  recommendation: Recommendation;
  onDismiss: () => void;
}) {
  const trace = useCognition((s) => s.trace);
  const chosenSim = trace?.simulations?.find(
    (s) => s.id === trace.decision?.chosenSimulationResultId,
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start gap-6"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <CheckCircle2 className="h-8 w-8 text-cognition" strokeWidth={1.5} />
      </motion.div>

      <div>
        <span className="eyebrow">Discovery complete</span>
        <h2 className="mt-1 text-[22px] font-light leading-tight tracking-[-0.02em] text-ink">
          {orgName}
        </h2>
      </div>

      {/* Recommendation headline */}
      <div className="w-full rounded-lg border border-line-subtle bg-surface p-4">
        <span className="eyebrow">Recommendation</span>
        <p className="mt-2 text-[14px] font-light leading-snug text-ink">{recommendation.action}</p>

        {chosenSim?.routePath && chosenSim.routePath.length > 0 && (
          <div className="mt-3.5 rounded border border-cognition/30 bg-cognition/[0.08] p-3 text-left">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-[9.5px] font-semibold text-cognition uppercase tracking-wider">
                Dijkstra Shortest Path
              </span>
              {typeof chosenSim.dijkstraCost === "number" && (
                <span className="font-mono text-[9.5px] font-bold text-cognition bg-cognition/20 px-1.5 py-0.5 rounded">
                  {chosenSim.dijkstraCost} Cost Units
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              {chosenSim.routePath.map((step: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted"
                >
                  <span className="text-ink font-medium">{step}</span>
                  {idx < chosenSim.routePath!.length - 1 && (
                    <span className="text-cognition font-bold">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-cognition"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.round(recommendation.confidence * 100)}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-cognition">
            {Math.round(recommendation.confidence * 100)}%
          </span>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-cognition py-2.5 font-mono text-[11px] uppercase tracking-wider text-void transition-all duration-300 hover:bg-cognition-bright hover:shadow-[0_0_12px_rgba(139,156,255,0.4)] cursor-pointer"
      >
        View Reasoning Trace & Map →
      </button>

      <span className="font-mono text-[10px] text-ink-ghost">Auto-closing in 2.5s…</span>
    </motion.div>
  );
}

function FailurePanel({
  error,
  orgName,
  onDismiss,
  onDiscover,
}: {
  error: string;
  orgName: string;
  onDismiss: () => void;
  onDiscover: DiscoverFn;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8 rounded-lg border border-severity-high/25 bg-severity-high/5 p-4"
    >
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-severity-high" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-severity-high">{error}</p>
          <button
            onClick={onDismiss}
            className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-faint transition-colors duration-200 hover:text-ink"
          >
            Dismiss
          </button>

          <MapsLinkFallback orgName={orgName} onDiscover={onDiscover} />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Recovery path when name-based resolution fails: the user pastes a Google
 * Maps link, the backend extracts a lat/lng pin from it (following
 * shortened links server-side — a browser can't read a cross-origin
 * redirect's final URL), and discovery retries with that point directly.
 * Errors here stay local to this form — they never re-throw or reset the
 * overlay, so a bad link just leaves the user free to try another one.
 */
function MapsLinkFallback({ orgName, onDiscover }: { orgName: string; onDiscover: DiscoverFn }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "resolving" | "error">("idle");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || status === "resolving") return;

    setStatus("resolving");
    setLocalError(null);

    resolveMapsLink(trimmed)
      .then((center) => {
        // From here, control passes to the shared discovery flow — its own
        // phase/error (surfaced by the parent FailurePanel) takes over
        // showing progress or failure. Resetting to "idle" here rather than
        // leaving "resolving" set matters because that flow can itself fail
        // for reasons unrelated to the link (e.g. a transient backend
        // conflict) — without this, this form's own submit button would stay
        // disabled forever even though the coordinates were resolved fine.
        setStatus("idle");
        // A ~1.1km box around the pin — wide enough to cover a campus or
        // landmark's surrounding infrastructure, small enough that Overpass
        // stays fast. Matches the granularity of a geocoded place lookup.
        const delta = 0.01;
        onDiscover(orgName, center, {
          south: center.lat - delta,
          north: center.lat + delta,
          west: center.lng - delta,
          east: center.lng + delta,
        });
      })
      .catch((err: unknown) => {
        setStatus("error");
        setLocalError(err instanceof Error ? err.message : "Could not resolve that link.");
      });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-severity-high/15 pt-3">
      <span className="font-mono text-[9px] uppercase tracking-widest text-ink-ghost">
        Or paste a Google Maps link
      </span>
      <div className="mt-2 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="https://maps.google.com/..."
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] text-ink outline-none placeholder:text-ink-ghost focus:border-cognition/40"
        />
        <button
          type="submit"
          disabled={!url.trim() || status === "resolving"}
          className={cn(
            "shrink-0 rounded-lg border border-cognition/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-cognition transition-colors duration-200",
            !url.trim() || status === "resolving"
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-cognition/10",
          )}
        >
          {status === "resolving" ? "Resolving…" : "Use link"}
        </button>
      </div>
      {status === "error" && localError && (
        <p className="mt-2 text-[11px] leading-snug text-severity-high">{localError}</p>
      )}
    </form>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Returns a formatted elapsed-time string ("3.2s") updated every 200 ms while
 * the discovery is running. Returns null when inactive so callers can easily
 * gate on it.
 */
function useElapsed(startedAt: number | null, active: boolean): string | null {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!active || startedAt === null) {
      setElapsed(null);
      return;
    }
    setElapsed(Date.now() - startedAt);
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  if (elapsed === null) return null;
  return `${(elapsed / 1000).toFixed(1)}s`;
}
