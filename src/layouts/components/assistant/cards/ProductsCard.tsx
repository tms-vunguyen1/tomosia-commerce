"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantApi } from "../api";
import ProductCard from "../ProductCard";
import ProductDetail from "../ProductDetail";
import { AgentProduct, ProductsPayload } from "../protocol";
import CardFrame from "./CardFrame";

/**
 * `present_products`: the picks the model made, each joined to its catalogue record.
 *
 * One card at a time can unfold a details panel, and that panel renders below the row
 * rather than inside a card, so opening one never pushes its siblings out of line.
 */
export default function ProductsCard({
  payload,
  api,
}: {
  payload: ProductsPayload;
  api: AssistantApi;
}) {
  const items = payload.items ?? [];
  const layout = payload.layout ?? "carousel";

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The panel stays mounted while it folds shut, so the collapse has something to animate.
  const [renderedId, setRenderedId] = useState<string | null>(null);
  const collapseRef = useRef<HTMLDivElement>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const syncOverflow = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setOverflow({
      left: node.scrollLeft > 4,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    syncOverflow();
    const node = scrollerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncOverflow, items.length]);

  // Adjusted during render rather than in an effect: opening a card should mount its
  // panel in the same commit, and closing leaves the old one mounted so the fold-shut
  // has something to animate (cleared on transition end, below).
  if (expandedId !== null && expandedId !== renderedId) {
    setRenderedId(expandedId);
  }

  useEffect(() => {
    if (!expandedId) return;
    // Bring the unfolding panel into view once it has height.
    const timer = window.setTimeout(
      () =>
        collapseRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [expandedId]);

  const nudge = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    node?.scrollBy({
      left: direction * (node.clientWidth - 80),
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  const rendered = items.find(
    ({ product }) => product.product_id === renderedId,
  );
  const open = expandedId != null && expandedId === renderedId;

  const toggle = (product: AgentProduct) =>
    setExpandedId((current) =>
      current === product.product_id ? null : product.product_id,
    );

  return (
    <CardFrame title={payload.title}>
      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={layout === "carousel" ? syncOverflow : undefined}
          className={
            layout === "grid"
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3"
              : layout === "list"
                ? "flex flex-col gap-3"
                : "flex gap-3 overflow-x-auto pb-1"
          }
        >
          {items.map((item) => (
            <ProductCard
              key={item.product.product_id}
              product={item.product}
              reason={item.reason}
              selected={item.product.product_id === expandedId}
              onOpen={toggle}
            />
          ))}
        </div>
        {overflow.left && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-body to-transparent dark:from-darkmode-body"
            />
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Scroll to previous products"
              className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full border border-neutral-200 bg-body px-2 py-1 text-text-dark shadow-md transition hover:border-primary dark:border-neutral-700 dark:bg-darkmode-body dark:text-white"
            >
              ‹
            </button>
          </>
        )}
        {overflow.right && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-body to-transparent dark:from-darkmode-body"
            />
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Scroll to more products"
              className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full border border-neutral-200 bg-body px-2 py-1 text-text-dark shadow-md transition hover:border-primary dark:border-neutral-700 dark:bg-darkmode-body dark:text-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div
        ref={collapseRef}
        className={`ac-collapse ${open ? "ac-collapse-open" : ""}`}
        onTransitionEnd={(event) => {
          if (event.propertyName === "grid-template-rows" && !expandedId) {
            setRenderedId(null);
          }
        }}
        aria-hidden={!open}
      >
        <div className="ac-collapse-inner">
          {rendered && (
            <ProductDetail
              key={rendered.product.product_id}
              api={api}
              product={rendered.product}
              reason={rendered.reason}
              onClose={() => setExpandedId(null)}
            />
          )}
        </div>
      </div>
    </CardFrame>
  );
}
