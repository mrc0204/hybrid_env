export * from "./base";
export * from "./input-events";
export * from "./ai-events";
export * from "./notification-events";

import type { InputEvent } from "./input-events";
import type { AIEvent } from "./ai-events";
import type { NotificationEvent } from "./notification-events";

/** Every event type that can appear on the event bus. */
export type SystemEvent = InputEvent | AIEvent | NotificationEvent;
