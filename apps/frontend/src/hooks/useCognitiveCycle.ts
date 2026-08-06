import { useEffect, useRef } from "react";

import { fetchLatestTrace, triggerEnvironmentRefresh, USE_MOCK } from "@/api/client";
import type { CognitiveTrace } from "@/mock/scenarios";
import { STAGES, useCognition } from "@/store/cognition";

/**
 * Drives the cognitive cycle: walks the six stages at each stage's own pace,
 * pauses so the completed recommendation can be read, then runs again.
 *
 * Stage durations differ deliberately — deliberation takes longest, perception
 * is quick. Uniform timing would read as a progress bar; varied timing reads
 * as thought.
 *
 * Two data sources, same choreography either way:
 *  - Mock (default): steps through the hand-authored scenarios in mock/scenarios.ts.
 *  - Live (`VITE_USE_MOCK=false`): triggers a real Backend pipeline cycle,
 *    fetches the resulting multi-agent trace, and animates through the exact
 *    same six stages with real WorldState/RiskState/SimulationResult/Decision
 *    data. No visual component changes between the two — only where the data
 *    in the store comes from.
 */
export function useCognitiveCycle(enabled: boolean) {
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const clearAll = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };

    const animateStages = (onDone: () => void) => {
      const { advanceStage, completeCycle } = useCognition.getState();
      let elapsed = 0;
      STAGES.forEach((stage, i) => {
        elapsed += stage.durationMs;
        if (i < STAGES.length - 1) {
          timers.current.push(window.setTimeout(advanceStage, elapsed));
        } else {
          timers.current.push(window.setTimeout(completeCycle, elapsed));
        }
      });

      const HOLD_MS = 9000;
      timers.current.push(window.setTimeout(onDone, elapsed + HOLD_MS));
    };

    const runMockCycle = () => {
      clearAll();
      const { startCycle, nextScenario } = useCognition.getState();
      startCycle();
      animateStages(() => {
        nextScenario();
        runMockCycle();
      });
    };

    const runLiveCycle = () => {
      clearAll();
      const { startCycle, setTrace } = useCognition.getState();
      startCycle();

      // Fetched before the stage animation starts, so real data is already
      // in the store by the time the spine reaches any given stage.
      void triggerEnvironmentRefresh()
        .then(() => fetchLatestTrace())
        .then((trace) => setTrace(toCognitiveTrace(trace)))
        .catch((err: unknown) => {
          console.error("[cognition] live trace fetch failed", err);
        })
        .finally(() => {
          animateStages(runLiveCycle);
        });
    };

    // Brief settle before the first cycle so the composition registers first.
    const bootTimer = window.setTimeout(USE_MOCK ? runMockCycle : runLiveCycle, 900);
    timers.current.push(bootTimer);

    return clearAll;
  }, [enabled]);
}

function toCognitiveTrace(trace: Awaited<ReturnType<typeof fetchLatestTrace>>): CognitiveTrace {
  return {
    key: trace.worldState.id,
    label: "Live",
    inputEvents: trace.inputEvents,
    worldState: trace.worldState,
    risks: trace.risks,
    simulations: trace.simulations,
    decision: trace.decision,
    recommendation: trace.recommendation,
  };
}
