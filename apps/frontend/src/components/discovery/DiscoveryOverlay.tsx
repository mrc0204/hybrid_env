import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import type { Recommendation } from "@ai-env/contracts";
import { cn } from "@/lib/utils";
import {
  DISCOVERY_STAGES,
  useDiscoveryStore,
  type DiscoveryPhase,
  type StageMetrics,
} from "@/store/discoveryStore";

interface DiscoveryOverlayProps {
  onCancel: () => void;
  onDismiss: () => void;
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
export function DiscoveryOverlay({ onCancel, onDismiss }: DiscoveryOverlayProps) {
  const phase = useDiscoveryStore((s) => s.phase);
  const orgName = useDiscoveryStore((s) => s.orgName);
  const currentStage = useDiscoveryStore((s) => s.currentStage);
  const completedStages = useDiscoveryStore((s) => s.completedStages);
  const metrics = useDiscoveryStore((s) => s.metrics);
  const recommendation = useDiscoveryStore((s) => s.recommendation);
  const error = useDiscoveryStore((s) => s.error);
  const startedAt = useDiscoveryStore((s) => s.startedAt);

  const elapsed = useElapsed(startedAt, phase === "running");

  // Auto-dismiss on success after a short read window.
  useEffect(() => {
    if (phase !== "success") return;
    const t = window.setTimeout(onDismiss, 3_500);
    return () => window.clearTimeout(t);
  }, [phase, onDismiss]);

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
            <SuccessPanel key="success" orgName={orgName} recommendation={recommendation} />
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
                    onDismiss={onDismiss}
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
}: {
  orgName: string;
  recommendation: Recommendation;
}) {
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

      <span className="font-mono text-[10px] text-ink-ghost">Closing…</span>
    </motion.div>
  );
}

function FailurePanel({ error, onDismiss }: { error: string; onDismiss: () => void }) {
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
        </div>
      </div>
    </motion.div>
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
