"use client";

import { useState } from "react";
import ImageFallback from "@/helpers/ImageFallback";
import { ApiError, resolveError } from "@/lib/assistant/errors";
import { useAssistantFrame } from "./frame";
import { AgentProduct, formatMoney, optionValuesLabel } from "./protocol";

export function hasOptions(product: Pick<AgentProduct, "options">): boolean {
  return Object.keys(product.options ?? {}).length > 0;
}

/** "From $345.00" on a family, whose price is its cheapest in-stock variant's. */
export function priceLabel(product: AgentProduct): string {
  const money = formatMoney(product.price, product.currency);
  return hasOptions(product) ? `From ${money}` : money;
}

/** What a variant chose, or what a family still needs chosen. */
export function optionText(product: AgentProduct): string {
  return (
    optionValuesLabel(product) ||
    Object.values(product.options ?? {})
      .map((values) => values.join(" · "))
      .join(" / ")
  );
}

/**
 * The add control over a card's image.
 *
 * A family is never added from here: the cart takes a variant, so the button hands the
 * choice to the assistant, which settles the option with the shopper and adds the right
 * one. That is the same rule the agent's options gate applies to the model.
 */
export function AddButton({ product }: { product: AgentProduct }) {
  const { ask, addToCart } = useAssistantFrame();
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<ApiError | null>(null);

  if (hasOptions(product)) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          ask(`Add the ${product.title} (${product.product_id}) to my cart.`);
        }}
        aria-label={`Choose options for ${product.title}`}
        className="pointer-events-auto absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-full bg-dark text-lg leading-none font-semibold text-white transition-transform hover:scale-105 dark:bg-light dark:text-text-dark"
      >
        +
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={async (event) => {
          event.stopPropagation();
          if (phase !== "idle") return;
          setPhase("busy");
          setError(null);
          const failure = await addToCart(product);
          setError(failure);
          setPhase(failure ? "error" : "done");
          window.setTimeout(() => setPhase("idle"), failure ? 1600 : 1200);
        }}
        aria-label={`Add ${product.title} to cart`}
        className={`pointer-events-auto absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-full text-lg leading-none font-semibold text-white transition-transform hover:scale-105 ${
          phase === "done"
            ? "bg-emerald-600"
            : phase === "error"
              ? "bg-red-600"
              : "bg-dark dark:bg-light dark:text-text-dark"
        } ${phase === "busy" ? "animate-pulse" : ""}`}
      >
        {phase === "done" ? "✓" : phase === "error" ? "!" : "+"}
      </button>
      {error && (
        <div
          role="alert"
          className="pointer-events-auto absolute inset-x-1 bottom-11 rounded-md bg-red-600 px-2 py-1 text-sm text-white"
        >
          {resolveError(error)}
        </div>
      )}
    </>
  );
}

/**
 * One catalogue record as the assistant showed it. Clicking the card opens the detail
 * panel the carousel renders underneath, so one card's details never push its siblings
 * out of line.
 */
export default function ProductCard({
  product,
  reason,
  selected = false,
  onOpen,
}: {
  product: AgentProduct;
  reason?: string | null;
  selected?: boolean;
  onOpen?: (product: AgentProduct) => void;
}) {
  const clickable = Boolean(onOpen);
  const soldOut = product.in_stock === false;

  return (
    <div
      className={`relative flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border bg-body transition-[border-color,box-shadow] hover:shadow-md dark:bg-darkmode-body ${
        selected
          ? "border-primary dark:border-darkmode-primary"
          : "border-neutral-200 dark:border-neutral-700"
      }`}
    >
      <div
        onClick={clickable ? () => onOpen?.(product) : undefined}
        onKeyDown={
          clickable
            ? (event) => event.key === "Enter" && onOpen?.(product)
            : undefined
        }
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-expanded={clickable ? selected : undefined}
        aria-label={clickable ? `Details for ${product.title}` : undefined}
        className={`flex flex-1 flex-col rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
          clickable ? "cursor-pointer" : ""
        }`}
      >
        <div className="relative h-36 w-full bg-neutral-100 dark:bg-neutral-800">
          {/* `fill` rather than width/height: the box is fixed and the photo is
              cropped to it, so intrinsic dimensions would only fight the CSS. */}
          <ImageFallback
            className="object-cover"
            src={product.image_url || "/images/image-placeholder.png"}
            fallback="/images/image-placeholder.png"
            alt={product.title}
            fill
            sizes="240px"
          />
          {soldOut && (
            <span className="absolute top-2 left-2 rounded-full bg-neutral-900/80 px-2.5 py-1 text-sm font-medium text-white">
              Out of stock
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          {product.brand && (
            <div className="truncate text-sm tracking-wide uppercase text-text-light dark:text-darkmode-text-light">
              {product.brand}
            </div>
          )}
          <div className="line-clamp-2 text-base leading-snug font-medium text-text-dark dark:text-white">
            {product.title}
          </div>
          {optionText(product) && (
            <div className="truncate text-sm text-text-light dark:text-darkmode-text-light">
              {optionText(product)}
            </div>
          )}
          <div className="mt-auto pt-1 text-lg font-semibold text-text-dark dark:text-white">
            {priceLabel(product)}
          </div>
          {reason && (
            <div className="line-clamp-2 text-sm text-text-dark/80 dark:text-white/80">
              {reason}
            </div>
          )}
        </div>
      </div>
      {!soldOut && (
        // A sibling of the clickable area, not a child of it: one control never nests
        // inside another.
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36">
          <AddButton product={product} />
        </div>
      )}
    </div>
  );
}
