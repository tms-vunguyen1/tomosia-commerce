"use client";

import { formatMoney, OrderStatusPayload } from "../protocol";
import CardFrame from "./CardFrame";

const STATUS_LABEL: Record<string, string> = {
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  cancelled: "Cancelled",
  return_initiated: "Return started",
  refunded: "Refunded",
};

const STATUS_TONE: Record<string, string> = {
  delivered: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  shipped: "bg-primary/10 text-text-dark dark:text-white",
  delayed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  cancelled: "bg-neutral-500/15 text-text-light dark:text-darkmode-text-light",
  refunded: "bg-neutral-500/15 text-text-light dark:text-darkmode-text-light",
};

/** `present_order_status`: the order record the backend read, plus the model's summary. */
export default function OrderStatusCard({
  payload,
}: {
  payload: OrderStatusPayload;
}) {
  const order = payload.order;
  if (!order) return null;
  const status = order.status ?? "processing";

  return (
    <CardFrame title={`Order ${order.order_id}`}>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span
          className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
            STATUS_TONE[status] ??
            "bg-primary/10 text-text-dark dark:text-white"
          }`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className="text-base text-text-light dark:text-darkmode-text-light">
          {new Date(order.placed_at).toLocaleDateString()} ·{" "}
          {formatMoney(order.total, order.currency)}
        </span>
      </div>
      <p className="mt-2 px-1 text-base text-text-dark dark:text-white">
        {payload.summary}
      </p>
      {order.items?.length ? (
        <ul className="mt-2 flex flex-col gap-1 px-1">
          {order.items.map((item, index) => (
            <li
              key={`${item.product_id}-${index}`}
              className="text-base text-text-light dark:text-darkmode-text-light"
            >
              {item.quantity} × {item.title}
            </li>
          ))}
        </ul>
      ) : null}
      {payload.next_step && (
        <p className="mt-2 px-1 text-base text-text-dark dark:text-white">
          {payload.next_step}
        </p>
      )}
      {order.tracking_url && (
        <a
          href={order.tracking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-text-dark transition hover:border-primary hover:text-primary dark:border-neutral-600 dark:text-white dark:hover:border-darkmode-primary"
        >
          Track this order
        </a>
      )}
    </CardFrame>
  );
}
