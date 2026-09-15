"use client";

import { useEffect, useState } from "react";
import ImageFallback from "@/helpers/ImageFallback";
import type { AssistantApi } from "./api";
import { useAssistantFrame } from "./frame";
import { AddButton, optionText, priceLabel } from "./ProductCard";
import {
  AgentProduct,
  AgentProductDetails,
  formatMoney,
  optionValuesLabel,
} from "./protocol";
import QuotedAsData from "./QuotedAsData";

/**
 * The variants of a family. Picking one hands the add to the assistant rather than
 * writing straight to the cart, so the choice and the write both sit in the transcript.
 */
function VariantList({
  family,
  variants,
}: {
  family: AgentProduct;
  variants: AgentProduct[];
}) {
  const { ask, busy } = useAssistantFrame();
  const pricesDiffer = variants.some(
    (variant) => variant.price !== variants[0]?.price,
  );
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Options">
      {variants.map((variant) => {
        const label = optionValuesLabel(variant) || variant.title;
        const available = variant.in_stock !== false;
        return (
          <li key={variant.product_id}>
            <button
              type="button"
              disabled={!available || busy}
              onClick={() =>
                ask(
                  `Add the ${family.title} in ${label} (${variant.product_id}) to my cart.`,
                )
              }
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-sm text-text-dark transition-colors hover:border-primary disabled:cursor-not-allowed disabled:line-through disabled:opacity-50 dark:border-neutral-600 dark:text-white dark:hover:border-darkmode-primary"
            >
              {label}
              {pricesDiffer && (
                <span className="text-text-light dark:text-darkmode-text-light">
                  {" · "}
                  {formatMoney(variant.price, variant.currency)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The panel that unfolds under a product card, fetched on open. */
export default function ProductDetail({
  api,
  product,
  reason,
  onClose,
}: {
  api: AssistantApi;
  product: AgentProduct;
  reason?: string | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<AgentProductDetails | null>(null);
  const [failed, setFailed] = useState(false);

  // No reset needed when the product changes: the carousel keys this component by
  // product id, so a different one is a fresh mount with fresh state.
  useEffect(() => {
    let mounted = true;
    void api.fetchProduct(product.product_id).then((value) => {
      if (!mounted) return;
      if (value) setDetails(value);
      else setFailed(true);
    });
    return () => {
      mounted = false;
    };
  }, [api, product.product_id]);

  const full = details ?? product;
  const specs = details?.specs ?? {};

  return (
    <div className="ac-reveal mt-3 mb-1 rounded-xl border border-neutral-200 bg-neutral-100/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/40">
      <div className="flex items-start gap-3">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg">
          <ImageFallback
            className="object-cover"
            src={full.image_url || "/images/image-placeholder.png"}
            fallback="/images/image-placeholder.png"
            alt={full.title}
            fill
            sizes="112px"
          />
          {full.in_stock !== false && <AddButton product={full} />}
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            {full.brand && (
              <div className="text-sm tracking-wide uppercase text-text-light dark:text-darkmode-text-light">
                {full.brand}
              </div>
            )}
            <div className="text-base leading-snug font-semibold text-text-dark dark:text-white">
              {full.title}
            </div>
            {optionText(full) && (
              <div className="text-sm text-text-light dark:text-darkmode-text-light">
                {optionText(full)}
              </div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-text-dark dark:text-white">
                {priceLabel(full)}
              </span>
              {full.in_stock === false && (
                <span className="rounded-full bg-neutral-900/85 px-2 py-0.5 text-sm font-medium text-white">
                  Out of stock
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse details"
            className="shrink-0 rounded-md px-1.5 text-lg leading-none text-text-light hover:text-text-dark dark:text-darkmode-text-light dark:hover:text-white"
          >
            ×
          </button>
        </div>
      </div>

      {reason && (
        <p className="mt-2 text-base leading-snug text-text-dark dark:text-white">
          {reason}
        </p>
      )}

      {details === null && !failed && (
        <p className="mt-2 animate-pulse text-base text-text-light dark:text-darkmode-text-light">
          Loading details…
        </p>
      )}
      {failed && (
        <p className="mt-2 text-base text-text-light dark:text-darkmode-text-light">
          No more detail is listed for this one.
        </p>
      )}

      {details && (
        <div className="ac-reveal">
          {details.variants?.length ? (
            <VariantList family={details} variants={details.variants} />
          ) : null}
          {details.long_description && (
            <p className="mt-2 line-clamp-6 text-base leading-relaxed text-text-dark dark:text-white">
              {details.long_description}
            </p>
          )}
          {Object.keys(specs).length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {Object.entries(specs).map(([key, value]) => (
                <div key={key} className="text-base">
                  <dt className="font-semibold capitalize text-text-light dark:text-darkmode-text-light">
                    {key.replaceAll("_", " ")}
                  </dt>
                  <dd className="text-text-dark dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {details.review_highlights?.length ? (
            <div className="mt-2">
              <div className="space-y-1">
                {details.review_highlights.slice(0, 3).map((highlight) => (
                  <p
                    key={highlight}
                    className="text-base leading-snug italic text-text-light dark:text-darkmode-text-light"
                  >
                    “{highlight}”
                  </p>
                ))}
              </div>
              <QuotedAsData subject="Customer-written" className="mt-1" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
