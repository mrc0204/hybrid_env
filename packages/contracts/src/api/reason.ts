import type { InputEvent } from "../events";

/**
 * Request body for the AI Core's `POST /reason`.
 *
 * The Backend collects and normalizes raw external signals into InputEvents
 * and sends them here; the AI Core never fetches from the outside world
 * itself. This is the seam that keeps external integration in the Backend and
 * all reasoning in the AI Core.
 */
export interface ReasonRequest {
  events: InputEvent[];
}
