"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import { ApiError, ErrorCode, resolveError } from "@/lib/assistant/errors";
import ActivityPanel from "./ActivityPanel";
import { AssistantApi } from "./api";
import { AssistantFrameProvider } from "./frame";
import CartPanel from "./CartPanel";
import type { AddToCart } from "./cards/types";
import MessageBubble from "./MessageBubble";
import { AgentCart } from "./protocol";
import { STARTERS } from "./starters";
import StarterPrompts from "./StarterPrompts";
import { useAgentTurn } from "./useAgentTurn";
import { useStickToBottom } from "./useStickToBottom";

export default function AssistantChat({
  active,
  activityOpen,
  onActivityClose,
}: {
  /** The dialog is open: the session starts on first use, not on page load. */
  active: boolean;
  activityOpen: boolean;
  onActivityClose: () => void;
}) {
  const api = useMemo(() => new AssistantApi(), []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<ApiError | null>(null);
  const [cart, setCart] = useState<AgentCart | null>(null);
  const [input, setInput] = useState("");

  const { items, busy, send, completed, trace } = useAgentTurn(api, {
    sessionId,
  });
  const { scrollRef, onScroll, showLatest, jumpToLatest } = useStickToBottom(
    items,
    busy,
  );

  // The cart panel's "Check out" scrolls to a summary the assistant has already shown
  // rather than asking for another one.
  const checkoutStaged = items.some(
    (item) =>
      item.kind === "assistant" &&
      item.segments.some(
        (segment) =>
          segment.type === "ui" && segment.block.component === "checkout",
      ),
  );

  useEffect(() => {
    if (!active || sessionId) return;
    let cancelled = false;
    void api.start().then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setStartError(result.error);
        return;
      }
      setSessionId(result.sessionId);
    });
    return () => {
      cancelled = true;
    };
  }, [active, api, sessionId]);

  // The cart is Shopify's and a reply may have written to it, so it is re-read once the
  // reply has streamed rather than tracked locally.
  useEffect(() => {
    if (!sessionId) return;
    void api.fetchCart().then((next) => next && setCart(next));
  }, [sessionId, completed, api]);

  const addToCart: AddToCart = useCallback(
    async (product) => {
      const result = await api.addToCart(product.product_id, 1);
      if ("error" in result) return result.error;
      if (result.cart) setCart(result.cart);
      return null;
    },
    [api],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy || !sessionId) return;
    setInput("");
    void send(trimmed);
  };

  return (
    <AssistantFrameProvider
      value={{ ask: (prompt) => void send(prompt), busy, addToCart }}
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollRef}
              onScroll={onScroll}
              aria-live="polite"
              className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-4 sm:px-6"
            >
              <div className="flex w-full max-w-3xl flex-1 flex-col gap-4">
                {startError ? (
                  <div
                    role="alert"
                    className="m-auto max-w-md text-center text-lg text-text-light dark:text-darkmode-text-light"
                  >
                    <p>{resolveError(startError)}</p>
                    {(startError.code === ErrorCode.ASSISTANT_UNREACHABLE ||
                      startError.code === ErrorCode.CONFIG_MISSING) && (
                      // Dev hint, English only.
                      <p className="mt-2 text-sm">
                        Start it with{" "}
                        <code className="font-mono">docker compose up</code> in{" "}
                        <code className="font-mono">shopping-agent/</code>, then
                        reopen this window.
                      </p>
                    )}
                  </div>
                ) : items.length === 0 ? (
                  <StarterPrompts
                    starters={STARTERS}
                    onSelect={(starter) => void send(starter.label)}
                  />
                ) : (
                  items.map((item, index) => (
                    <MessageBubble
                      key={
                        item.kind === "user"
                          ? `user-${index}`
                          : `turn-${item.turn}`
                      }
                      item={item}
                      api={api}
                      busy={busy}
                      isLast={index === items.length - 1}
                      onSuggestion={(suggestion) => void send(suggestion)}
                    />
                  ))
                )}
              </div>
            </div>

            {showLatest && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <button
                  type="button"
                  onClick={jumpToLatest}
                  className="pointer-events-auto rounded-full border border-neutral-300 bg-body px-3.5 py-1.5 text-sm font-semibold text-text-dark shadow-md transition hover:border-primary dark:border-neutral-600 dark:bg-darkmode-body dark:text-white dark:hover:border-darkmode-primary"
                >
                  ↓ Latest
                </button>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 sm:px-6">
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-neutral-200 bg-body py-2 pr-2 pl-5 shadow-sm transition-colors focus-within:border-primary dark:border-neutral-700 dark:bg-darkmode-body dark:focus-within:border-darkmode-primary"
            >
              <input
                name="assistant-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={sessionId ? "Ask about a product…" : "Connecting…"}
                aria-label="Message the shopping assistant"
                disabled={!sessionId}
                className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-base text-text-dark outline-none focus:ring-transparent disabled:opacity-60 dark:text-white"
              />
              <button
                type="submit"
                aria-label="Send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dark text-white transition hover:brightness-110 disabled:opacity-40 dark:bg-light dark:text-text-dark"
                disabled={busy || !sessionId || !input.trim()}
              >
                <FaArrowUp size={18} />
              </button>
            </form>
          </div>
        </div>

        {activityOpen ? (
          <ActivityPanel trace={trace} busy={busy} onClose={onActivityClose} />
        ) : (
          <CartPanel
            cart={cart}
            busy={busy}
            checkoutStaged={checkoutStaged}
            onAsk={(prompt) => void send(prompt)}
          />
        )}
      </div>
    </AssistantFrameProvider>
  );
}
