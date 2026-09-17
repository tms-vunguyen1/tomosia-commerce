"use client";

/**
 * The browser's client for the merchant assistant. Mirrors
 * `src/layouts/components/assistant/api.ts`.
 *
 * Every call goes to this app's own `/merchant/api/*` routes, never to the agent
 * service: the operator identity stays server-side, and the session id — which is the
 * request credential — travels in the session header alone.
 */

import type { StagedChange } from "./types";
import type { AgentEvent } from "./protocol";

const BASE = "/merchant/api";
const SESSION_HEADER = "X-Session-Id";

export interface StartedSession {
  sessionId: string;
  operator: string;
}

export interface ChangeActionResult {
  ok: boolean;
  change: StagedChange | null;
  reason?: string;
}

export class ApiRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ApiRequestError";
  }
}

export class MerchantApi {
  session: string | null = null;

  private headers(json = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.session) headers[SESSION_HEADER] = this.session;
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async start(): Promise<StartedSession | { error: string }> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/session`, { method: "POST" });
    } catch {
      return { error: "ASSISTANT_UNREACHABLE" };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: body?.error?.code ?? "ASSISTANT_UNREACHABLE" };
    }
    this.session = body.session_id;
    return { sessionId: body.session_id, operator: body.operator ?? "" };
  }

  /** Throws an `ApiRequestError` on failure. */
  async *chatStream(message: string): AsyncGenerator<AgentEvent> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ message }),
      });
    } catch {
      throw new ApiRequestError("ASSISTANT_UNREACHABLE");
    }
    if (!response.ok || !response.body) {
      throw new ApiRequestError("ASSISTANT_UNREACHABLE");
    }
    yield* readEventStream(response.body);
  }

  /** The change preview card's Approve button, run through the same gate as the
   * model's own `apply_change` tool. */
  async applyChange(changeId: string): Promise<ChangeActionResult> {
    return this.changeAction(changeId, "apply");
  }

  /** The change preview card's Dismiss button. */
  async discardChange(changeId: string): Promise<ChangeActionResult> {
    return this.changeAction(changeId, "discard");
  }

  private async changeAction(
    changeId: string,
    action: "apply" | "discard",
  ): Promise<ChangeActionResult> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/changes/${encodeURIComponent(changeId)}/${action}`, {
        method: "POST",
        headers: this.headers(),
      });
    } catch {
      return { ok: false, change: null, reason: "The assistant is unavailable right now." };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        change: null,
        reason: typeof body?.detail === "string" ? body.detail : "That could not be done.",
      };
    }
    return body as ChangeActionResult;
  }
}

async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trimEnd();
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ") && eventType) {
        try {
          yield { type: eventType, data: JSON.parse(line.slice(6)) } as AgentEvent;
        } catch {
          // A malformed frame is dropped; the stream continues.
        }
      } else if (line === "") {
        eventType = null;
      }
    }
  }
}
