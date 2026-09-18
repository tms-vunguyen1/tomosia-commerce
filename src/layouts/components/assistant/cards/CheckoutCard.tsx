"use client";

import { useEffect, useRef } from "react";
import { useAssistantFrame } from "../frame";
import { CheckoutPayload, formatMoney } from "../protocol";
import CardFrame from "./CardFrame";

/**
 * `checkout`: the cart, staged for payment.
 *
 * Nothing in the assistant places an order or takes money. The button opens Shopify's
 * hosted checkout for this cart — a URL the backend attached to the payload after the
 * model's call, so the model never supplied or saw it. Only https links are followed.
 *
 * Checkout opens in a popup rather than a tab so the chat stays put: Shopify's hosted
 * checkout has no callback of its own, so the storefront's homepage (where its
 * `theme.liquid` bounces the customer back to) posts a message back to this popup's
 * opener and closes itself (`CheckoutPopupHandoff`). Once that arrives, this asks the
 * question a shopper would ask next — through the same chat turn as everything else,
 * so the order-status card that comes back is a real tool call, not a side channel.
 */
export default function CheckoutCard({
  payload,
}: {
  payload: CheckoutPayload;
}) {
  const { ask } = useAssistantFrame();
  const popupRef = useRef<Window | null>(null);
  const cart = payload.cart;
  const handoff = (payload.handoffs ?? []).find((each) =>
    each.url?.startsWith("https://"),
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "checkout-complete") return;
      popupRef.current?.close();
      popupRef.current = null;
      ask("I just finished checking out — what's the status of my order?");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ask]);

  if (!cart?.items?.length) return null;

  const startCheckout = (url: string) => {
    // Chrome only renders a chrome-less popup window when the "popup" feature
    // token is present — width/height alone now just open a regular tab.
    const popup = window.open(
      url,
      "shopify-checkout",
      "popup=yes,width=520,height=760",
    );
    if (!popup) {
      window.location.href = url; // popup blocked — fall back to a plain navigation
      return;
    }
    popupRef.current = popup;
  };

  return (
    <CardFrame title="Ready to check out" anchor="checkout">
      <ul className="flex flex-col gap-2 px-1">
        {cart.items.map((line) => (
          <li
            key={line.product_id}
            className="flex items-baseline justify-between gap-3 text-base"
          >
            <span className="min-w-0 truncate text-text-dark dark:text-white">
              {line.quantity} × {line.title}
            </span>
            <span className="shrink-0 font-medium text-text-dark dark:text-white">
              {formatMoney(line.line_total, cart.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 px-1 pt-3 dark:border-neutral-700">
        <span className="text-text-light dark:text-darkmode-text-light">
          Subtotal
        </span>
        <span className="text-lg font-bold text-text-dark dark:text-white">
          {formatMoney(cart.subtotal, cart.currency)}
        </span>
      </div>
      {payload.note && (
        <p className="mt-2 px-1 text-sm text-text-light dark:text-darkmode-text-light">
          {payload.note}
        </p>
      )}
      {handoff ? (
        <a
          href={handoff.url}
          onClick={(e) => {
            e.preventDefault();
            startCheckout(handoff.url);
          }}
          className="btn btn-primary mt-3 block w-full text-center text-base"
        >
          {handoff.label ?? "Check out"}
        </a>
      ) : (
        <p className="mt-3 px-1 text-sm text-text-light dark:text-darkmode-text-light">
          Open the cart to finish checking out.
        </p>
      )}
    </CardFrame>
  );
}
