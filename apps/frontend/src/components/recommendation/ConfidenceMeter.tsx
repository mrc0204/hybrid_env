import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Certainty = "high" | "moderate" | "low";

export function certaintyOf(confidence: number): Certainty {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.6) return "moderate";
  return "low";
}

const CERTAINTY_COPY: Record<Certainty, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence — human review advised",
};

/**
 * Confidence as an arc rather than a progress bar.
 *
 * A bar implies completion; an arc implies a reading on a dial, which is what
 * confidence actually is. The threshold tick at 60% is drawn explicitly so the
 * number has a reference point — "0.44" means nothing until you can see it sits
 * below the bar for autonomous action.
 */
export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const certainty = certaintyOf(confidence);
  const [display, setDisplay] = useState(0);

  const progress = useMotionValue(0);
  const RADIUS = 52;
  const CIRC = Math.PI * RADIUS; // semicircle
  const dashOffset = useTransform(progress, (p) => CIRC * (1 - p));

  useEffect(() => {
    const controls = animate(progress, confidence, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v * 100)),
    });
    return controls.stop;
  }, [confidence, progress]);

  const stroke =
    certainty === "high" ? "#8B9CFF" : certainty === "moderate" ? "#E0A458" : "#E07B54";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[62px] w-[124px] shrink-0">
        <svg viewBox="0 0 124 62" className="h-full w-full overflow-visible">
          {/* Track */}
          <path
            d="M 9 58 A 52 52 0 0 1 115 58"
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Value */}
          <motion.path
            d="M 9 58 A 52 52 0 0 1 115 58"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            style={{ strokeDashoffset: dashOffset }}
          />
          {/* Governance threshold at 60% — the line autonomous action requires. */}
          <line
            x1={62 - RADIUS * Math.cos(Math.PI * 0.6)}
            y1={58 - RADIUS * Math.sin(Math.PI * 0.6)}
            x2={62 - (RADIUS + 7) * Math.cos(Math.PI * 0.6)}
            y2={58 - (RADIUS + 7) * Math.sin(Math.PI * 0.6)}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1.5"
          />
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="numeric text-[26px] font-light leading-none tracking-tight text-ink">
            {display}
            <span className="text-[12px] text-ink-ghost">%</span>
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <div
          className={cn(
            "text-[12px] font-medium",
            certainty === "high" && "text-cognition",
            certainty === "moderate" && "text-severity-medium",
            certainty === "low" && "text-severity-high",
          )}
        >
          {CERTAINTY_COPY[certainty]}
        </div>
        <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-ghost">
          threshold 60% for autonomous action
        </div>
      </div>
    </div>
  );
}
