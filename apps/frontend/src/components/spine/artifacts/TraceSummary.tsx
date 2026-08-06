import { motion } from "framer-motion";

import { SEVERITY_HEX } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { useCognition } from "@/store/cognition";

/**
 * The closing argument.
 *
 * Once a recommendation exists, the most useful thing the trace panel can show
 * is the whole chain at once: which signals produced which understanding,
 * which risks that raised, which path won, and on what authority. Each link
 * names the domain model behind it, so a sceptical reader can walk the
 * reasoning end to end without leaving the screen.
 */
export function TraceSummary() {
  const trace = useCognition((s) => s.trace);
  const highlight = useCognition((s) => s.highlight);
  const highlighted = useCognition((s) => s.highlightedRefId);

  const chosen = trace.simulations.find((s) => s.id === trace.decision.chosenSimulationResultId);
  const rejected = trace.simulations.length - 1;

  return (
    <div className="space-y-2">
      <Link
        index={0}
        model="InputEvent[]"
        title={`${trace.inputEvents.length} signals ingested`}
        body={trace.inputEvents
          .map((e) => e.source)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" · ")}
      />

      <Link
        index={1}
        model="WorldState"
        title={`World model v${trace.worldState.version}`}
        body={trace.worldState.summary}
        refId={trace.worldState.id}
        highlighted={highlighted}
        onHover={highlight}
      />

      <Link
        index={2}
        model="RiskState[]"
        title={
          trace.risks.length === 0
            ? "No active risks"
            : `${trace.risks.length} risk${trace.risks.length > 1 ? "s" : ""} detected`
        }
        body={trace.risks.map((r) => `${r.riskType} (${r.severity})`).join(" · ") || undefined}
        accent={trace.risks[0] ? SEVERITY_HEX[trace.risks[0].severity] : undefined}
        refId={trace.risks[0]?.id}
        highlighted={highlighted}
        onHover={highlight}
      />

      <Link
        index={3}
        model="SimulationResult[]"
        title={chosen ? `Chosen: ${Math.round(chosen.successProbability * 100)}% success` : "—"}
        body={
          chosen
            ? `${chosen.candidateAction}${rejected > 0 ? ` — beat ${rejected} alternative${rejected > 1 ? "s" : ""}` : ""}`
            : undefined
        }
      />

      <Link
        index={4}
        model="Decision"
        title={`Consensus ${Math.round(trace.decision.consensusScore * 100)}% · ${trace.decision.governanceStatus.replace(/_/g, " ")}`}
        body={trace.decision.rationale}
        accent={trace.decision.consensusScore < 0.6 ? "#E0A458" : undefined}
      />

      <Link
        index={5}
        model="Recommendation"
        title={trace.recommendation.title}
        body="Issued — see recommendation panel"
        isTerminal
      />
    </div>
  );
}

interface LinkProps {
  index: number;
  model: string;
  title: string;
  body?: string;
  accent?: string;
  refId?: string;
  highlighted?: string | null;
  onHover?: (id: string | null) => void;
  isTerminal?: boolean;
}

function Link({
  index,
  model,
  title,
  body,
  accent,
  refId,
  highlighted,
  onHover,
  isTerminal,
}: LinkProps) {
  const isHot = Boolean(refId && highlighted === refId);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => refId && onHover?.(refId)}
      onMouseLeave={() => refId && onHover?.(null)}
      className={cn(
        "relative rounded-lg border px-3.5 py-2.5 pl-5 transition-colors duration-200",
        isTerminal
          ? "border-cognition/30 bg-cognition/[0.07]"
          : isHot
            ? "border-cognition/40 bg-cognition/[0.07]"
            : "border-line-subtle bg-surface",
      )}
    >
      <div
        className="absolute inset-y-2 left-0 w-[2px] rounded-full"
        style={{ backgroundColor: accent ?? (isTerminal ? "#8B9CFF" : "rgba(255,255,255,0.12)") }}
      />

      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "text-[12.5px] font-medium leading-snug",
            isTerminal ? "text-cognition" : "text-ink",
          )}
        >
          {title}
        </span>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-ghost">
          {model}
        </span>
      </div>

      {body && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">{body}</p>}
    </motion.div>
  );
}
