"use client";

import ImageFallback from "@/helpers/ImageFallback";
import { ComparisonPayload, formatMoney } from "../protocol";
import { useAssistantFrame } from "../frame";
import CardFrame from "./CardFrame";

/**
 * `present_comparison`: two to four products side by side. The price spread is computed
 * by the agent from the same records, so the card never does its own arithmetic on
 * figures the model wrote.
 */
export default function ComparisonCard({
  payload,
}: {
  payload: ComparisonPayload;
}) {
  const { addToCart } = useAssistantFrame();
  const entries = payload.entries ?? [];
  if (entries.length < 2) return null;

  return (
    <CardFrame title={payload.title ?? "Side by side"}>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => {
          const recommended =
            payload.recommended_product_id === entry.product_id;
          return (
            <div
              key={entry.product_id}
              className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-3 ${
                recommended
                  ? "border-primary dark:border-darkmode-primary"
                  : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <ImageFallback
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  src={
                    entry.product.image_url || "/images/image-placeholder.png"
                  }
                  fallback="/images/image-placeholder.png"
                  alt={entry.product.title}
                  width={56}
                  height={56}
                />
                <div className="min-w-0">
                  <div className="text-base leading-snug font-medium text-text-dark dark:text-white">
                    {entry.product.title}
                  </div>
                  <div className="text-base font-semibold text-text-dark dark:text-white">
                    {formatMoney(entry.product.price, entry.product.currency)}
                  </div>
                </div>
              </div>
              {recommended && (
                <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary dark:bg-darkmode-primary/15 dark:text-darkmode-primary">
                  Recommended
                </span>
              )}
              {entry.best_for && (
                <div className="text-sm text-text-light dark:text-darkmode-text-light">
                  Best for {entry.best_for}
                </div>
              )}
              {entry.pros?.length ? (
                <ul className="flex flex-col gap-0.5 text-sm text-text-dark dark:text-white">
                  {entry.pros.map((pro) => (
                    <li key={pro}>
                      <span aria-hidden className="text-emerald-600">
                        +
                      </span>{" "}
                      {pro}
                    </li>
                  ))}
                </ul>
              ) : null}
              {entry.cons?.length ? (
                <ul className="flex flex-col gap-0.5 text-sm text-text-light dark:text-darkmode-text-light">
                  {entry.cons.map((con) => (
                    <li key={con}>
                      <span aria-hidden>−</span> {con}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!Object.keys(entry.product.options ?? {}).length &&
                entry.product.in_stock !== false && (
                  <button
                    type="button"
                    onClick={() => void addToCart(entry.product)}
                    className="mt-auto rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-text-dark transition hover:border-primary hover:text-primary dark:border-neutral-600 dark:text-white dark:hover:border-darkmode-primary"
                  >
                    Add to cart
                  </button>
                )}
            </div>
          );
        })}
      </div>
      {payload.price_delta && (
        <p className="mt-2 px-1 text-sm text-text-light dark:text-darkmode-text-light">
          {formatMoney(payload.price_delta.amount)} between the cheapest and the
          dearest.
        </p>
      )}
    </CardFrame>
  );
}
