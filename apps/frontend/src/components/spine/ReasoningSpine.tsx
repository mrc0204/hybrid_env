import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { STAGES, useCognition, useVisibleStage, type StageId } from "@/store/cognition";

/**
 * The Reasoning Spine — the interface's organising idea.
 *
 * A cycle travels down these six stages, each producing a real domain model.
 * Watching activation move is what communicates "this system is thinking";
 * clicking a stage to interrogate its artifact is what makes the thinking
 * trustworthy rather than theatrical.
 */
export function ReasoningSpine() {
  const activeStage = useCognition((s) => s.activeStage);
  const isRunning = useCognition((s) => s.isRunning);
  const inspectStage = useCognition((s) => s.inspectStage);
  const visible = useVisibleStage();

  return (
    <div className="relative flex flex-col gap-0.5 px-2">
      {STAGES.map((stage) => {
        const isDone = activeStage > stage.index;
        const isActive = activeStage === stage.index;
        const isPending = activeStage < stage.index;
        const isVisible = visible === stage.id;

        return (
          <StageNode
            key={stage.id}
            id={stage.id}
            index={stage.index}
            name={stage.name}
            produces={stage.produces}
            isDone={isDone}
            isActive={isActive && isRunning}
            isPending={isPending}
            isSelected={isVisible}
            isLast={stage.index === STAGES.length - 1}
            onSelect={() => inspectStage(stage.id)}
          />
        );
      })}
    </div>
  );
}

interface StageNodeProps {
  id: StageId;
  index: number;
  name: string;
  produces: string;
  isDone: boolean;
  isActive: boolean;
  isPending: boolean;
  isSelected: boolean;
  isLast: boolean;
  onSelect: () => void;
}

function StageNode({
  index,
  name,
  produces,
  isDone,
  isActive,
  isPending,
  isSelected,
  isLast,
  onSelect,
}: StageNodeProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3.5 rounded-lg py-2.5 pl-2 pr-3 text-left transition-colors duration-300",
        isSelected ? "bg-surface-raised" : "hover:bg-surface",
      )}
    >
      {/* Rail + marker column */}
      <div className="relative flex w-4 shrink-0 flex-col items-center pt-1">
        <StageMarker isDone={isDone} isActive={isActive} isPending={isPending} />

        {!isLast && (
          <div className="relative mt-1 h-7 w-px overflow-hidden bg-line">
            {/* The connector fills only once a stage completes, so the rail
                itself records how far reasoning has progressed. */}
            <motion.div
              className="absolute inset-x-0 top-0 bg-cognition"
              initial={{ height: "0%" }}
              animate={{ height: isDone ? "100%" : "0%" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-[13px] font-medium leading-tight transition-colors duration-300",
              isActive ? "text-cognition" : isDone || isSelected ? "text-ink" : "text-ink-faint",
            )}
          >
            {name}
          </span>
          <span className="numeric text-micro text-ink-ghost">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div
          className={cn(
            "mt-0.5 truncate font-mono text-[10px] transition-colors duration-300",
            isActive ? "text-cognition/70" : isDone ? "text-ink-faint" : "text-ink-ghost",
          )}
        >
          {produces}
        </div>
      </div>
    </button>
  );
}

function StageMarker({
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
      {/* Halo, only while this stage is the one being worked on. */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full bg-cognition/25"
          animate={{ scale: [1, 1.85, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.div
        className={cn(
          "relative h-2 w-2 rounded-full border transition-colors duration-300",
          isDone && "border-cognition bg-cognition",
          isActive && "border-cognition bg-cognition",
          isPending && "border-line-strong bg-transparent",
        )}
        animate={isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 1.6, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
      />
    </div>
  );
}
