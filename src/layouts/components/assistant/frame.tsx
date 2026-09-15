"use client";

/**
 * What every card inside the transcript needs from the conversation around it.
 *
 * Follows `useStoreFrame` in `examples/web-shared/storefront/frame.ts`: a card is nested
 * four levels below the chat, and both of these would otherwise be threaded through
 * every card component that never uses them.
 *
 * `ask` is the important one — it is how a control inside a card writes to the cart.
 * Sending a message means the write is a tool call the assistant made, under the same
 * gates, and visible in the transcript, rather than a side-channel the conversation
 * never learns about.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { AddToCart } from "./cards/types";

interface AssistantFrame {
  /** Send a message as the shopper. */
  ask: (prompt: string) => void;
  /** A reply is streaming, so a control that would send another waits. */
  busy: boolean;
  /** The add button's direct write, which runs through the agent's own executor. */
  addToCart: AddToCart;
}

const FrameContext = createContext<AssistantFrame | null>(null);

export function AssistantFrameProvider({
  value,
  children,
}: {
  value: AssistantFrame;
  children: ReactNode;
}) {
  return <FrameContext value={value}>{children}</FrameContext>;
}

export function useAssistantFrame(): AssistantFrame {
  const frame = useContext(FrameContext);
  if (!frame) {
    throw new Error(
      "useAssistantFrame must be used inside AssistantFrameProvider",
    );
  }
  return frame;
}
