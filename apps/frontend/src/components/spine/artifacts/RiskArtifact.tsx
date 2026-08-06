import type { RiskState } from "@ai-env/contracts";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { SEVERITY_HEX } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { useCognition } from "@/store/cognition";

/**
 * Detected risks, ordered by severity.
 *
 * Each card carries a severity spine on its left edge — colour is load-bearing
 * here, so it is given a dedicated structural element rather than being left to
 * text colour alone, which would fail for colour-blind viewers. The severity
 * word is always present in text.
 */
export function RiskArtifact({ risks }: { risks: RiskState[] }) {
  const highlighted = useCognition((s) => s.highlightedRefId);
  const highlight = useCognition((s) => s.highlight);

  if (risks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-surface py-10"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-severity-low" />
        <span className="text-[13px] text-ink-muted">No active risks detected</span>
        <span className="font-mono text-[10px] text-ink-ghost">
          Environment within normal parameters
        </span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {risks.map((risk, i) => (
        <motion.div
          key={risk.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={() => highlight(risk.id)}
          onMouseLeave={() => highlight(null)}
          className={cn(
            "relative overflow-hidden rounded-lg border bg-surface pl-4 pr-3.5 py-3 transition-colors duration-200",
            highlighted === risk.id
              ? "border-cognition/40 bg-cognition/[0.07]"
              : "border-line-subtle",
          )}
        >
          <div
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundColor: SEVERITY_HEX[risk.severity] }}
          />

          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-[11px] text-ink">{risk.riskType}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone={risk.severity}>{risk.severity}</Badge>
              {risk.status === "monitoring" && <Badge>monitoring</Badge>}
            </div>
          </div>

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{risk.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
