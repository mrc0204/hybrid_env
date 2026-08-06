/**
 * Every event flowing through the system (input, AI, notification) shares this
 * envelope. `TType` is narrowed per concrete event so consumers can discriminate
 * on `type` and get the matching `payload` shape for free.
 */
export interface BaseEvent<TType extends string = string> {
  id: string;
  type: TType;
  timestamp: string;
  source: string;
  correlationId?: string;
}
