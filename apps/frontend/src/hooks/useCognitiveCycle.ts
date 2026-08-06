import { useEffect, useRef } from "react";

import { STAGES, useCognition } from "@/store/cognition";

/**
 * Drives the cognitive cycle: walks the six stages at each stage's own pace,
 * pauses so the completed recommendation can be read, then advances to the
 * next environmental scenario and runs again.
 *
 * Stage durations differ deliberately — deliberation takes longest, perception
 * is quick. Uniform timing would read as a progress bar; varied timing reads
 * as thought.
 *
 * When the Backend is connected this hook is replaced by a Socket.IO
 * subscription to `recommendation.generated`; nothing downstream changes.
 */
export function useCognitiveCycle(enabled: boolean) {
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const clearAll = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };

    const runCycle = () => {
      clearAll();
      const { startCycle, advanceStage, completeCycle, nextScenario } = useCognition.getState();

      startCycle();

      let elapsed = 0;
      STAGES.forEach((stage, i) => {
        elapsed += stage.durationMs;
        if (i < STAGES.length - 1) {
          timers.current.push(window.setTimeout(advanceStage, elapsed));
        } else {
          timers.current.push(window.setTimeout(completeCycle, elapsed));
        }
      });

      // Hold on the finished recommendation long enough to actually read it.
      const HOLD_MS = 9000;
      timers.current.push(
        window.setTimeout(() => {
          nextScenario();
          runCycle();
        }, elapsed + HOLD_MS),
      );
    };

    // Brief settle before the first cycle so the composition registers first.
    const bootTimer = window.setTimeout(runCycle, 900);
    timers.current.push(bootTimer);

    return clearAll;
  }, [enabled]);
}
