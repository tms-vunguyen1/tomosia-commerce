"use client";

import ProductCard from "../ProductCard";
import { PlanPayload } from "../protocol";
import CardFrame from "./CardFrame";

/** `present_plan`: an ordered list of steps, each able to carry the products it needs. */
export default function PlanCard({ payload }: { payload: PlanPayload }) {
  const steps = payload.steps ?? [];
  if (!steps.length) return null;

  return (
    <CardFrame title={payload.title}>
      {payload.intro && (
        <p className="mb-3 px-1 text-base text-text-light dark:text-darkmode-text-light">
          {payload.intro}
        </p>
      )}
      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-text-dark dark:bg-darkmode-primary/15 dark:text-white"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium text-text-dark dark:text-white">
                {step.label}
              </div>
              {step.detail && (
                <p className="text-base text-text-light dark:text-darkmode-text-light">
                  {step.detail}
                </p>
              )}
              {step.products?.length ? (
                <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                  {step.products.map((product) => (
                    <ProductCard key={product.product_id} product={product} />
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </CardFrame>
  );
}
