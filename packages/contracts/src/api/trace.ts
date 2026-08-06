import type { Decision, Recommendation, RiskState, SimulationResult, WorldState } from "../domain";
import type { InputEvent } from "../events";

/**
 * The full cognitive trace behind the most recent `POST /reason` call —
 * every intermediate artifact, not just the final Recommendation.
 *
 * `/reason` itself keeps returning only `Recommendation` (unchanged, so the
 * existing Backend pipeline isn't touched); this is what lets the Frontend's
 * Reasoning Spine show the real WorldState/RiskState/SimulationResult/Decision
 * behind a recommendation instead of re-deriving or mocking them.
 */
export interface ReasonTrace {
  inputEvents: InputEvent[];
  worldState: WorldState;
  risks: RiskState[];
  simulations: SimulationResult[];
  decision: Decision;
  recommendation: Recommendation;
}
