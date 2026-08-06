import type { Decision } from "@ai-env/contracts";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The expert council.
 *
 * Votes arrive one at a time rather than as a list, because a council that
 * appears fully-formed reads as a lookup table; one that fills in reads as a
 * debate. Dissent is styled as clearly as agreement — hiding it would make the
 * consensus number meaningless.
 */
export function DeliberationArtifact({ decision }: { decision: Decision }) {
  const votes = decision.expertVotes ?? [];
  const consensusPct = Math.round(decision.consensusScore * 100);
  const isContested = decision.consensusScore < 0.6;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line-subtle bg-surface px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Consensus</span>
          <Badge
            tone={
              decision.governanceStatus === "approved"
                ? "low"
                : decision.governanceStatus === "rejected"
                  ? "critical"
                  : "medium"
            }
          >
            {decision.governanceStatus.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="mt-2.5 flex items-end gap-3">
          <motion.span
            key={consensusPct}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "numeric text-[30px] font-light leading-none tracking-tight",
              isContested ? "text-severity-medium" : "text-ink",
            )}
          >
            {consensusPct}
            <span className="text-[13px] text-ink-ghost">%</span>
          </motion.span>

          <div className="mb-1 flex-1">
            {/* Segmented rather than continuous: consensus is a count of
                agreeing experts, and segments say that honestly. */}
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.12 }}
                  animate={{ opacity: i < Math.round(decision.consensusScore * 10) ? 1 : 0.12 }}
                  transition={{ delay: 0.3 + i * 0.045, duration: 0.3 }}
                  className={cn(
                    "h-4 flex-1 rounded-[2px]",
                    isContested ? "bg-severity-medium" : "bg-cognition",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {decision.governanceNotes && (
          <p className="mt-3 border-t border-line-subtle pt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
            {decision.governanceNotes}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="eyebrow">Council · {votes.length} experts</span>
        {votes.map((vote, i) => {
          const dissents = /dissent|divert|no action/i.test(vote.vote) && isContested;
          return (
            <motion.div
              key={vote.expertName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.14, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-line-subtle bg-surface px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-medium text-ink">{vote.expertName}</span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase",
                    dissents ? "text-severity-medium" : "text-cognition/80",
                  )}
                >
                  {vote.vote}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">{vote.rationale}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
