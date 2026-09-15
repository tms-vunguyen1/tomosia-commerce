"use client";

import { CheckoutPayload, formatMoney } from "../protocol";
import CardFrame from "./CardFrame";

/**
 * `checkout`: the cart, staged for payment.
 *
 * Nothing in the assistant places an order or takes money. The button opens Shopify's
 * hosted checkout for this cart — a URL the backend attached to the payload after the
 * model's call, so the model never supplied or saw it. Only https links are followed.
 */
export default function CheckoutCard({
  payload,
}: {
  payload: CheckoutPayload;
}) {
  const cart = payload.cart;
  if (!cart?.items?.length) return null;
  const handoff = (payload.handoffs ?? []).find((each) =>
    each.url?.startsWith("https://"),
  );

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
          target="_blank"
          rel="noopener noreferrer"
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
