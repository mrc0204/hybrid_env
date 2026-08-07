import type { EvidenceRef } from "@ai-env/contracts";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCognition } from "@/store/cognition";
import { useVoiceIntelligence } from "@/hooks/useVoiceIntelligence";
import { certaintyOf, ConfidenceMeter } from "./ConfidenceMeter";

const EVIDENCE_LABEL: Record<EvidenceRef["type"], string> = {
  world_state: "World",
  risk_state: "Risk",
  input_event: "Signal",
  note: "Note",
};

/**
 * The output. Action first, in the largest type on screen — a recommendation
 * whose headline is a category name ("Traffic Advisory") makes the reader hunt
 * for the instruction. Everything below it exists to justify it.
 *
 * Below the 60% governance threshold the panel visibly changes character:
 * the action is de-emphasised, a review banner appears, and alternatives are
 * promoted. A system that looks equally certain at 44% and 87% is one you
 * eventually stop believing.
 */
import { useEffect, useRef } from "react";

export function RecommendationPanel() {
  const trace = useCognition((s) => s.trace);
  const activeStage = useCognition((s) => s.activeStage);
  const highlight = useCognition((s) => s.highlight);
  const highlighted = useCognition((s) => s.highlightedRefId);

  const {
    speakBriefing,
    explainTrace,
    stopSpeaking,
    isSpeaking,
    isLoadingModel,
    isSupported,
  } = useVoiceIntelligence();

  const rec = trace.recommendation;
  const isReady = activeStage >= 5;
  const certainty = certaintyOf(rec.confidence);
  const needsReview = certainty === "low";

  const hasSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (isReady && trace.key && hasSpokenRef.current !== trace.key) {
      hasSpokenRef.current = trace.key;
      // Delay speech synthesis slightly so visual recommendation renders first
      const t = setTimeout(() => {
        speakBriefing();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isReady, trace.key, speakBriefing]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence mode="wait">
        {!isReady ? (
          <PendingState key="pending" stage={activeStage} />
        ) : (
          <motion.div
            key={`rec-${rec.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {needsReview && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 flex items-center gap-2 rounded-lg border border-severity-high/30 bg-severity-high/10 px-3 py-2"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-severity-high" />
                  <span className="text-[11.5px] leading-snug text-severity-high">
                    Held for human review — consensus below threshold
                  </span>
                </motion.div>
              )}

              {/* The instruction. */}
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "text-[26px] font-light leading-[1.18] tracking-[-0.02em]",
                  needsReview ? "text-ink-muted" : "text-ink",
                )}
              >
                {rec.action}
              </motion.h1>

              {/* Dijkstra Optimal Route guidance box */}
              {(() => {
                const chosenSim = trace.simulations.find(
                  (s) => s.id === trace.decision.chosenSimulationResultId,
                );
                if (!chosenSim?.routePath || chosenSim.routePath.length === 0) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                    className="mt-4 rounded-xl border border-cognition/30 bg-cognition/[0.08] p-3.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[11px] font-semibold text-cognition uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cognition animate-pulse" />
                        Dijkstra Shortest/Least-Cost Route
                      </span>
                      {typeof chosenSim.dijkstraCost === "number" && (
                        <span className="font-mono text-[11px] font-bold text-cognition bg-cognition/20 px-2 py-0.5 rounded border border-cognition/30">
                          {chosenSim.dijkstraCost} Cost Units
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      {chosenSim.routePath.map((step, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-muted bg-surface px-2.5 py-1 rounded-md border border-line-subtle"
                        >
                          <span className="text-ink font-medium">{step}</span>
                          {idx < chosenSim.routePath!.length - 1 && (
                            <span className="text-cognition font-bold">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="mt-5"
              >
                <ConfidenceMeter confidence={rec.confidence} />
              </motion.div>

              {/* ── Executive Voice Actions ────────────────────────────────────── */}
              {isSupported && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28, duration: 0.4 }}
                  className="mt-4 flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={isSpeaking ? stopSpeaking : speakBriefing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cognition/30 bg-cognition/10 px-3 py-2 text-[11px] font-medium text-cognition transition-colors hover:bg-cognition/20"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                    {isLoadingModel
                      ? "Loading Kokoro TTS..."
                      : isSpeaking
                        ? "Mute Briefing"
                        : "Listen Executive Briefing"}
                  </button>

                  <button
                    type="button"
                    onClick={explainTrace}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-ink-muted transition-colors hover:border-white/20 hover:text-white"
                    title="Explain decision reasoning using existing evidence"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    Explain "Why?"
                  </button>
                </motion.div>
              )}

              {/* ── Gemini Critic Review Card ─────────────────────────── */}
              {trace.decision.governanceNotes && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-3.5 w-3.5"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      Gemini Critic Review
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                        trace.decision.governanceNotes.includes("[CHALLENGED]")
                          ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                          : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                      )}
                    >
                      {trace.decision.governanceNotes.includes("[CHALLENGED]")
                        ? "Challenged"
                        : "Approved"}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-ink-muted">
                    {trace.decision.governanceNotes}
                  </p>
                </motion.div>
              )}

              <div className="my-5 h-px rule-fade" />

              {/* Reasoning */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="eyebrow">Why</span>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{rec.reasoning}</p>
              </motion.div>

              {/* Evidence — hovering cross-highlights the map and stage views. */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.44, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="mt-5"
              >
                <span className="eyebrow">Evidence · {rec.evidence.length}</span>
                <div className="mt-2 space-y-1.5">
                  {rec.evidence.map((ev, i) => (
                    <button
                      key={`${ev.type}-${ev.refId ?? i}`}
                      onMouseEnter={() => ev.refId && highlight(ev.refId)}
                      onMouseLeave={() => highlight(null)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                        highlighted && ev.refId === highlighted
                          ? "border-cognition/40 bg-cognition/10"
                          : "border-line-subtle bg-surface hover:border-line",
                      )}
                    >
                      <span className="mt-[3px] shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-ghost">
                        {EVIDENCE_LABEL[ev.type]}
                      </span>
                      <span className="text-[11.5px] leading-relaxed text-ink-muted">
                        {ev.description}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Alternatives — promoted when confidence is low. */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.54, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "mt-5 rounded-lg",
                  needsReview && "border border-line-subtle bg-surface p-3",
                )}
              >
                <span className="eyebrow">
                  {needsReview ? "Alternatives — weigh these" : "Also considered"}
                </span>
                <div className="mt-2 space-y-2">
                  {rec.alternatives.map((alt) => (
                    <div key={alt.option} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-px w-3 shrink-0 bg-line-strong" />
                      <div>
                        <div className="text-[12px] text-ink-muted">{alt.option}</div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
                          {alt.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="flex items-center justify-between border-t border-line-subtle px-6 py-3">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{rec.status}</Badge>
                {rec.targetUserIds?.length ? (
                  <span className="font-mono text-[10px] text-ink-ghost">
                    → {rec.targetUserIds[0]}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-ink-ghost">→ broadcast</span>
                )}
              </div>
              {rec.validUntil && (
                <span className="font-mono text-[10px] text-ink-ghost">
                  valid{" "}
                  {new Date(rec.validUntil).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Pre-recommendation state. Naming the stage the system is currently in makes
 * the wait legible rather than blank — the user knows the machine is working
 * and on what.
 */
function PendingState({ stage }: { stage: number }) {
  const labels = ["Perceiving", "Modelling", "Assessing risk", "Simulating", "Deliberating"];
  const label = stage < 0 ? "Standing by" : (labels[stage] ?? "Composing");

  return (
    <motion.div
      key="pending"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6"
    >
      <div className="relative h-10 w-10">
        <motion.div
          className="absolute inset-0 rounded-full border border-cognition/30"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-cognition/30"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
        />
        <div className="absolute inset-[14px] rounded-full bg-cognition/70" />
      </div>

      <div className="text-center">
        <div className="text-[13px] text-ink-muted">{label}</div>
        <div className="mt-1 font-mono text-[10px] text-ink-ghost">recommendation pending</div>
      </div>
    </motion.div>
  );
}
