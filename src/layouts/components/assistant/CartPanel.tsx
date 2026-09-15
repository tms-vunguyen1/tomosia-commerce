"use client";

import ImageFallback from "@/helpers/ImageFallback";
import {
  AgentCart,
  AgentCartLine,
  formatMoney,
  lineName,
  optionValuesLabel,
  plural,
} from "./protocol";

/**
 * The session's cart — the storefront's own, not a copy: the assistant writes to the
 * same Shopify cart the header shows.
 *
 * Every write here is a message to the assistant rather than a direct call, so the cart
 * only ever changes through a tool call it made: the transcript stays the record of what
 * happened, and the same provenance and quantity gates cover the buttons and the model
 * alike. The cost is a turn per press, so the controls wait while one is streaming.
 */

function Stepper({
  line,
  busy,
  onAsk,
}: {
  line: AgentCartLine;
  busy: boolean;
  onAsk: (prompt: string) => void;
}) {
  const change = (quantity: number) =>
    onAsk(
      quantity < 1
        ? `Remove the ${lineName(line)} from my cart.`
        : `Change the ${lineName(line)} quantity to ${quantity}.`,
    );

  return (
    <div className="flex items-center rounded-full border border-neutral-300 dark:border-neutral-600">
      <button
        type="button"
        disabled={busy}
        onClick={() => change(line.quantity - 1)}
        aria-label={`Decrease ${line.title} quantity`}
        className="px-2.5 py-1 text-text-dark disabled:opacity-40 dark:text-white"
      >
        −
      </button>
      <span className="min-w-[1.4rem] text-center text-base tabular-nums text-text-dark dark:text-white">
        {line.quantity}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => change(line.quantity + 1)}
        aria-label={`Increase ${line.title} quantity`}
        className="px-2.5 py-1 text-text-dark disabled:opacity-40 dark:text-white"
      >
        +
      </button>
    </div>
  );
}

export default function CartPanel({
  cart,
  busy,
  checkoutStaged,
  onAsk,
}: {
  cart: AgentCart | null;
  /** A reply is streaming; every control here would queue behind it. */
  busy: boolean;
  /** The assistant has already shown a checkout card this session. */
  checkoutStaged: boolean;
  onAsk: (prompt: string) => void;
}) {
  const items = cart?.items ?? [];
  const count = cart?.item_count ?? 0;
  const currency = cart?.currency ?? "USD";

  const checkout = () => {
    if (checkoutStaged) {
      const cards = document.querySelectorAll("[data-card='checkout']");
      const last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    onAsk("Check out my cart.");
  };

  return (
    <aside className="hidden w-96 shrink-0 flex-col border-l border-neutral-200 lg:flex dark:border-neutral-700">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <h2 className="text-lg font-bold text-text-dark dark:text-white">
          Cart
        </h2>
        {/* Keyed on the count so a new count remounts the badge and replays the pop. */}
        <span
          key={count}
          className="ac-pop rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-text-dark dark:bg-darkmode-primary/15 dark:text-white"
        >
          {plural(count, "item")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {items.length === 0 ? (
          <p className="mt-8 text-center text-lg text-text-light dark:text-darkmode-text-light">
            Your cart is empty so far.
            <br />
            Ask the assistant to track something down.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {items.map((line) => (
              <li key={line.product_id} className="flex gap-3 py-3 first:pt-0">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <ImageFallback
                    className="object-cover"
                    src={line.image_url || "/images/image-placeholder.png"}
                    fallback="/images/image-placeholder.png"
                    alt={line.title}
                    fill
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-base leading-snug font-medium text-text-dark dark:text-white">
                        {line.title}
                      </div>
                      {optionValuesLabel(line) && (
                        <div className="truncate text-sm text-text-light dark:text-darkmode-text-light">
                          {optionValuesLabel(line)}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-semibold tabular-nums text-text-dark dark:text-white">
                        {formatMoney(line.line_total, currency)}
                      </div>
                      {line.quantity > 1 && (
                        <div className="text-sm text-text-light dark:text-darkmode-text-light">
                          {formatMoney(line.price, currency)} each
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Stepper line={line} busy={busy} onAsk={onAsk} />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onAsk(`Remove the ${lineName(line)} from my cart.`)
                      }
                      aria-label={`Remove ${line.title}`}
                      className="text-sm text-text-light underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-40 dark:text-darkmode-text-light dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <div className="flex items-baseline justify-between text-lg">
          <span className="text-text-light dark:text-darkmode-text-light">
            {count ? `Subtotal · ${plural(count, "item")}` : "Subtotal"}
          </span>
          <span className="text-xl font-bold tabular-nums text-text-dark dark:text-white">
            {formatMoney(cart?.subtotal ?? 0, currency)}
          </span>
        </div>
        <button
          type="button"
          onClick={checkout}
          disabled={items.length === 0 || (busy && !checkoutStaged)}
          className="btn btn-primary mt-3 w-full text-base disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkoutStaged ? "View summary" : "Check out"}
        </button>
        {items.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onAsk("Look over my cart: anything missing or worth swapping?")
            }
            className="mt-2.5 w-full text-center text-sm font-semibold text-primary transition hover:brightness-110 disabled:opacity-40 dark:text-darkmode-primary"
          >
            Ask about this cart
          </button>
        )}
      </div>
    </aside>
  );
}
