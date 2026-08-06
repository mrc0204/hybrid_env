import type { SimulationResult } from "@ai-env/contracts";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Candidate futures, ranked.
 *
 * The probability bars share a single scale so the chosen path's advantage is
 * visible as *distance*, not just as a larger number. Showing the rejected
 * candidates at all is the point: a system that only displays its winner is
 * asking to be trusted, while one that shows what it beat has earned it.
 */
export function SimulationArtifact({
  simulations,
  chosenId,
}: {
  simulations: SimulationResult[];
  chosenId: string;
}) {
  const ranked = [...simulations].sort((a, b) => b.successProbability - a.successProbability);

  return (
    <div className="space-y-2.5">
      {ranked.map((sim, i) => {
        const isChosen = sim.id === chosenId;
        return (
          <motion.div
            key={sim.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.11, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "rounded-lg border px-3.5 py-3 transition-colors",
              isChosen
                ? "border-cognition/40 bg-cognition/[0.07]"
                : "border-line-subtle bg-surface opacity-70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p
                className={cn(
                  "text-[12.5px] font-medium leading-snug",
                  isChosen ? "text-ink" : "text-ink-muted",
                )}
              >
                {sim.candidateAction}
              </p>
              <span
                className={cn(
                  "numeric shrink-0 text-[15px] font-medium tabular-nums",
                  isChosen ? "text-cognition" : "text-ink-faint",
                )}
              >
                {Math.round(sim.successProbability * 100)}
                <span className="text-[10px] text-ink-ghost">%</span>
              </span>
            </div>

            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className={cn("h-full rounded-full", isChosen ? "bg-cognition" : "bg-ink-ghost")}
                initial={{ width: 0 }}
                animate={{ width: `${sim.successProbability * 100}%` }}
                transition={{ delay: 0.25 + i * 0.11, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
              {sim.predictedOutcome}
            </p>

            {sim.routePath && sim.routePath.length > 0 && (
              <div className="mt-2.5 rounded border border-cognition/20 bg-cognition/[0.04] p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[10px] font-semibold text-cognition uppercase tracking-wider">
                    Dijkstra Shortest Path
                  </span>
                  {typeof sim.dijkstraCost === "number" && (
                    <span className="font-mono text-[10px] font-bold text-cognition bg-cognition/15 px-1.5 py-0.5 rounded">
                      {sim.dijkstraCost} Cost Units
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                  {sim.routePath.map((step, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted"
                    >
                      <span>{step}</span>
                      {idx < sim.routePath!.length - 1 && (
                        <span className="text-cognition font-bold">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {sim.estimatedCost && !sim.routePath && (
              <p className="mt-1 font-mono text-[10px] text-ink-ghost">
                cost · {sim.estimatedCost}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
