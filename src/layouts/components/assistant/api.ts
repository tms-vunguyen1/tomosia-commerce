/**
 * The browser's client for the assistant.
 *
 * Every call goes to this app's own `/api/assistant/*` routes, never to the agent
 * service: the Shopify customer token and the cart id stay on the server, and the
 * session id — which is the request credential — travels in the session header alone.
 * No request here names a customer.
 */

import { ApiError, ErrorCode, parseApiError } from "@/lib/assistant/errors";
import type { AgentCart, AgentEvent, AgentProductDetails } from "./protocol";

const BASE = "/api/assistant";
const SESSION_HEADER = "X-Session-Id";

export interface StartedSession {
  sessionId: string;
  name: string | null;
  signedIn: boolean;
}

/** Thrown by `chatStream` when the request never reaches a response body to read a code from. */
export class ApiRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ApiRequestError";
  }
}

export class AssistantApi {
  session: string | null = null;

  private headers(json = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.session) headers[SESSION_HEADER] = this.session;
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  /** Reads return null on any failure, so callers keep their last good state. */
  private async request<T>(path: string, init: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(`${BASE}${path}`, init);
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  async start(): Promise<StartedSession | { error: ApiError }> {
    // Identity comes from the browser's cookies, read server-side; the body only
    // carries the shopper's own time zone.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let response: Response;
    try {
      response = await fetch(`${BASE}/session`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ timezone }),
      });
    } catch {
      return { error: { code: ErrorCode.ASSISTANT_UNREACHABLE } };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        error: parseApiError(body) ?? { code: ErrorCode.ASSISTANT_UNREACHABLE },
      };
    }
    this.session = body.session_id;
    return {
      sessionId: body.session_id,
      name: body.name ?? null,
      signedIn: Boolean(body.signed_in),
    };
  }

  async fetchCart(): Promise<AgentCart | null> {
    return this.request<AgentCart>("/cart", { headers: this.headers() });
  }

  /** The full record behind a card, read when the shopper expands it. Public catalogue
   * data, so it carries no session header. */
  async fetchProduct(productId: string): Promise<AgentProductDetails | null> {
    return this.request<AgentProductDetails>(
      `/product?id=${encodeURIComponent(productId)}`,
      {},
    );
  }

  /** The add button on a product card, run through the agent's own gates. */
  async addToCart(
    productId: string,
    quantity = 1,
  ): Promise<{ cart: AgentCart | null } | { error: ApiError }> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/cart/add`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ product_id: productId, quantity }),
      });
    } catch {
      return { error: { code: ErrorCode.ASSISTANT_UNREACHABLE } };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        error: parseApiError(body) ?? { code: ErrorCode.CART_ADD_FAILED },
      };
    }
    return { cart: (body.cart ?? null) as AgentCart | null };
  }

  /** Throws an `ApiRequestError` on failure, resolved to display text by the caller. */
  async *chatStream(message: string): AsyncGenerator<AgentEvent> {
    let response: Response;
    try {
      response = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ message }),
      });
    } catch {
      throw new ApiRequestError(ErrorCode.ASSISTANT_UNREACHABLE);
    }
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      throw new ApiRequestError(
        parseApiError(body)?.code ?? ErrorCode.ASSISTANT_UNREACHABLE,
      );
    }
    yield* readEventStream(response.body);
  }
}

async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
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
          yield {
            type: eventType,
            data: JSON.parse(line.slice(6)),
          } as AgentEvent;
        } catch {
          // A malformed frame is dropped; the stream continues.
        }
      } else if (line === "") {
        eventType = null;
      }
    }
  }
}
