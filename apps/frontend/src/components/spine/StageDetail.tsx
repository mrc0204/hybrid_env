import { AnimatePresence, motion } from "framer-motion";

import { DeliberationArtifact } from "./artifacts/DeliberationArtifact";
import { PerceptionArtifact } from "./artifacts/PerceptionArtifact";
import { RiskArtifact } from "./artifacts/RiskArtifact";
import { SimulationArtifact } from "./artifacts/SimulationArtifact";
import { TraceSummary } from "./artifacts/TraceSummary";
import { WorldStateArtifact } from "./artifacts/WorldStateArtifact";
import { STAGES, useCognition, useVisibleStage } from "@/store/cognition";

/**
 * Renders the artifact for whichever stage is in view. Transitions are a short
 * cross-fade with a small vertical offset — enough to signal "different
 * content", not so much that it costs the reader their place.
 */
export function StageDetail() {
  const trace = useCognition((s) => s.trace);
  const stageId = useVisibleStage();
  const stage = STAGES.find((s) => s.id === stageId)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-title font-medium text-ink">{stage.name}</h2>
          <span className="font-mono text-[10px] text-cognition/70">{stage.produces}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">{stage.note}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${trace.key}-${stageId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {stageId === "perceive" && <PerceptionArtifact events={trace.inputEvents} />}
            {stageId === "model" && <WorldStateArtifact worldState={trace.worldState} />}
            {stageId === "assess" && <RiskArtifact risks={trace.risks} />}
            {stageId === "simulate" && (
              <SimulationArtifact
                simulations={trace.simulations}
                chosenId={trace.decision.chosenSimulationResultId}
              />
            )}
            {stageId === "deliberate" && <DeliberationArtifact decision={trace.decision} />}
            {stageId === "recommend" && <TraceSummary />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
