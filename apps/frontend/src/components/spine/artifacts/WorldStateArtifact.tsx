import type { WorldState } from "@ai-env/contracts";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useCognition } from "@/store/cognition";

/**
 * The world model's own account of what it understands.
 *
 * The summary types out character by character. This is the one place
 * literal typing is honest rather than gimmicky: the summary is the system's
 * narrative understanding, and watching it form is watching comprehension
 * happen. Everything else in the interface appears instantly.
 */
export function WorldStateArtifact({ worldState }: { worldState: WorldState }) {
  const typed = useTypewriter(worldState.summary, 14);
  const highlighted = useCognition((s) => s.highlightedRefId);
  const highlight = useCognition((s) => s.highlight);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[14px] leading-relaxed text-ink">
          {typed}
          {typed.length < worldState.summary.length && (
            <motion.span
              className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] bg-cognition"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
            />
          )}
        </p>
      </div>

      <div className="h-px rule-fade" />

      <div>
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="eyebrow">Tracked entities</span>
          <span className="numeric text-micro text-ink-ghost">
            v{worldState.version} · {worldState.entities.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {worldState.entities.map((entity, i) => (
            <motion.button
              key={entity.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => highlight(entity.id)}
              onMouseLeave={() => highlight(null)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                highlighted === entity.id
                  ? "border-cognition/40 bg-cognition/10"
                  : "border-line-subtle bg-surface hover:border-line",
              )}
            >
              <div className="truncate text-[12px] font-medium text-ink">{entity.label}</div>
              <div className="mt-0.5 font-mono text-[10px] text-ink-faint">{entity.type}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function useTypewriter(text: string, msPerChar: number): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar]);

  return shown;
}
