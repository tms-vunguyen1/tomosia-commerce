"use client";

/**
 * One turn's event stream, reduced into the transcript `Transcript`/`GenerativeBlock`
 * already know how to render (`TranscriptTurn`/`Block` — the same shapes the static
 * fixture transcript uses). Deliberately simpler than the shopping assistant's
 * `useAgentTurn.ts`: no per-segment interleaving, no partial-frame pacing
 * (`ui_partial` is skipped — a card appears once its final `ui` frame lands), no retry
 * bookkeeping. `ui_partial`/`tool_call`/`tool_result`/`progress`/`change_update` are
 * read for nothing yet — add an activity indicator here if that turns out to matter.
 */

import { useCallback, useState } from "react";
import type { ApiRequestError, ChangeActionResult, MerchantApi } from "./api";
import type { AgentEvent } from "./protocol";
import type { Block, TranscriptTurn } from "./types";

export interface MerchantChat {
  turns: TranscriptTurn[];
  busy: boolean;
  ready: boolean;
  send: (text: string) => Promise<void>;
  onApprove: (changeId: string) => Promise<ChangeActionResult>;
  onDismiss: (changeId: string) => Promise<ChangeActionResult>;
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof Error && error.name === "ApiRequestError";
}

export function useMerchantChat(api: MerchantApi, sessionId: string | null): MerchantChat {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [busy, setBusy] = useState(false);

  const updateLastAssistantTurn = useCallback(
    (update: (turn: TranscriptTurn) => TranscriptTurn) => {
      setTurns((previous) => {
        const next = [...previous];
        const last = next[next.length - 1];
        if (!last || last.role !== "assistant") return previous;
        next[next.length - 1] = update(last);
        return next;
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === "text_delta") {
        const delta = String(event.data.text ?? "");
        updateLastAssistantTurn((turn) => ({
          ...turn,
          text: (turn.text ?? "") + delta,
          pending: false,
        }));
        return;
      }
      if (event.type === "ui") {
        const component = String(event.data.component ?? "");
        if (component !== "metrics" && component !== "digest" && component !== "change_preview") {
          return; // "suggestions" (chips) has no composer affordance here yet
        }
        const block = { component, payload: event.data.payload ?? {} } as Block;
        updateLastAssistantTurn((turn) => ({
          ...turn,
          blocks: [...(turn.blocks ?? []), block],
          pending: false,
        }));
        return;
      }
      if (event.type === "error") {
        const text = String(event.data.message ?? "Something went wrong.");
        updateLastAssistantTurn((turn) => ({
          ...turn,
          text: turn.text ? `${turn.text}\n\n${text}` : text,
          pending: false,
        }));
      }
    },
    [updateLastAssistantTurn],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !sessionId) return;
      setBusy(true);
      setTurns((previous) => [
        ...previous,
        { role: "user", text: message },
        { role: "assistant", text: "", blocks: [], pending: true },
      ]);
      try {
        for await (const event of api.chatStream(message)) {
          handleEvent(event);
        }
      } catch (thrown) {
        const text = isApiRequestError(thrown)
          ? "The assistant is unavailable right now. Please try again."
          : "Something went wrong. Please try again.";
        updateLastAssistantTurn((turn) => (turn.text ? turn : { ...turn, text, pending: false }));
      } finally {
        setBusy(false);
      }
    },
    [api, busy, sessionId, handleEvent, updateLastAssistantTurn],
  );

  const onApprove = useCallback((changeId: string) => api.applyChange(changeId), [api]);
  const onDismiss = useCallback((changeId: string) => api.discardChange(changeId), [api]);

  return { turns, busy, ready: sessionId != null, send, onApprove, onDismiss };
}
