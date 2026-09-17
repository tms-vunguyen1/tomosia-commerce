/**
 * The merchant assistant's wire protocol, mirroring `commerce_common/streaming.py` —
 * the same event shape `src/layouts/components/assistant/protocol.ts` mirrors for the
 * shopping assistant. Card payloads are `Block` in `./types`, keyed by the same
 * `component` name the merchant agent's `PRESENTATION_COMPONENTS` uses.
 */

export type AgentEventType =
  | "text_delta"
  | "tool_call"
  | "tool_result"
  | "ui"
  | "ui_partial"
  | "change_update"
  | "progress"
  | "turn_complete"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
}
