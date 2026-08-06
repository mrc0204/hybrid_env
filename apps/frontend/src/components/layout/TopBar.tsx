import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { peakSeverity } from "@/lib/severity";
import { useCognition } from "@/store/cognition";

/**
 * System identity and liveness. Deliberately not a navigation bar — there is
 * nowhere else to go. The interface is one continuous view of one system.
 */
export function TopBar() {
  const isRunning = useCognition((s) => s.isRunning);
  const cycleCount = useCognition((s) => s.cycleCount);
  const trace = useCognition((s) => s.trace);
  const severity = peakSeverity(trace.risks);

  return (
    <header className="flex shrink-0 items-center justify-between px-7 py-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[13px] font-medium tracking-[-0.01em] text-ink">
          Environment Intelligence
        </h1>
        <span className="font-mono text-[10px] text-ink-ghost">{trace.worldState.scope}</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <motion.span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isRunning ? "bg-cognition" : severity ? "bg-severity-medium" : "bg-severity-low",
            )}
            animate={isRunning ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
            transition={{ duration: 1.4, repeat: isRunning ? Infinity : 0, ease: "easeInOut" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {isRunning ? "Reasoning" : "Observing"}
          </span>
        </div>

        <div className="h-3 w-px bg-line" />

        <span className="numeric text-[10px] text-ink-ghost">
          cycle {String(cycleCount).padStart(3, "0")}
        </span>
      </div>
    </header>
  );
}
