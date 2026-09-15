"use client";

import ProductCard from "../ProductCard";
import { GuidePayload } from "../protocol";
import CardFrame from "./CardFrame";

/**
 * `present_guide`: how to choose, in sections. The sources are the store's own policy
 * pages, named so the shopper can tell an answer from the help content apart from one
 * the assistant reasoned out.
 */
export default function GuideCard({ payload }: { payload: GuidePayload }) {
  const sections = payload.sections ?? [];
  if (!sections.length && !payload.title) return null;

  return (
    <CardFrame title={payload.title}>
      <div className="flex flex-col gap-3">
        {sections.map((section, index) => (
          <div key={`${section.heading}-${index}`}>
            <h4 className="text-base font-medium text-text-dark dark:text-white">
              {section.heading}
            </h4>
            <p className="text-base whitespace-pre-line text-text-light dark:text-darkmode-text-light">
              {section.body}
            </p>
          </div>
        ))}
      </div>
      {payload.related_products?.length ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {payload.related_products.map((product) => (
            <ProductCard key={product.product_id} product={product} />
          ))}
        </div>
      ) : null}
      {payload.sources?.length ? (
        <p className="mt-3 px-1 text-sm text-text-light dark:text-darkmode-text-light">
          From: {payload.sources.join(", ")}
        </p>
      ) : null}
    </CardFrame>
  );
}
