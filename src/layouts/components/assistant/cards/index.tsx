"use client";

/**
 * The card registry: one entry per component in the agent's `PRESENTATION_COMPONENTS`.
 *
 * A component with no card here would silently disappear from a reply, so an unknown
 * one renders its payload as readable text instead — which is also what a text-only
 * surface would do.
 */

import {
  CheckoutPayload,
  ComparisonPayload,
  GuidePayload,
  OrderStatusPayload,
  PlanPayload,
  ProductsPayload,
  UIBlock,
  UISlotStatus,
} from "../protocol";
import CheckoutCard from "./CheckoutCard";
import ComparisonCard from "./ComparisonCard";
import GuideCard from "./GuideCard";
import OrderStatusCard from "./OrderStatusCard";
import PlanCard from "./PlanCard";
import ProductsCard from "./ProductsCard";
import type { AssistantApi } from "../api";

function Unknown({ block }: { block: UIBlock }) {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 p-3 text-sm whitespace-pre-wrap text-text-light dark:border-neutral-600 dark:text-darkmode-text-light">
      {JSON.stringify(block.payload, null, 2)}
    </section>
  );
}

export default function AssistantCard({
  block,
  status,
  api,
}: {
  block: UIBlock;
  status: UISlotStatus;
  /** Only the products card reads more than the payload: it fetches a record's full
   * details when the shopper expands it. */
  api: AssistantApi;
}) {
  const card = (() => {
    switch (block.component) {
      case "products":
        return (
          <ProductsCard payload={block.payload as ProductsPayload} api={api} />
        );
      case "comparison":
        return <ComparisonCard payload={block.payload as ComparisonPayload} />;
      case "plan":
        return <PlanCard payload={block.payload as PlanPayload} />;
      case "guide":
        return <GuideCard payload={block.payload as GuidePayload} />;
      case "order_status":
        return (
          <OrderStatusCard payload={block.payload as OrderStatusPayload} />
        );
      case "checkout":
        return <CheckoutCard payload={block.payload as CheckoutPayload} />;
      default:
        return <Unknown block={block} />;
    }
  })();

  if (!card) return null;
  // A card whose call failed validation stays on screen, dimmed, until the model's retry
  // adopts its slot.
  return (
    <div
      className={
        status === "retrying" ? "opacity-50 transition-opacity" : undefined
      }
    >
      {card}
    </div>
  );
}
