"use client";

import { Fragment } from "react";
import { formatMoney, OrderStatusPayload, AgentOrder } from "../protocol";
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

/** Rail stages reached; statuses absent here render no rail. */
const RAIL_PROGRESS: Record<string, number> = {
  processing: 1,
  shipped: 3,
  delayed: 3,
  out_for_delivery: 3,
  delivered: 4,
};

const RAIL_STAGES = ["Ordered", "Packed", "Shipped", "Delivered"] as const;

function shortDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  // Parsed by parts so the local timezone can't shift it a day.
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function DeliveryRail({ order }: { order: AgentOrder }) {
  const reached = RAIL_PROGRESS[order.status];
  if (reached == null) return null;
  const delayed = order.status === "delayed";
  // In the estimate string the first ISO date is the current estimate; a second one is the
  // missed original.
  const estimateDates = [
    ...(order.estimated_delivery ?? "").matchAll(/\d{4}-\d{2}-\d{2}/g),
  ].map((match) => match[0]);
  const estimate = estimateDates[0];
  const original = delayed ? estimateDates[1] : undefined;
  const deliveredOn = order.status === "delivered" ? estimate : undefined;

  return (
    <div className="mt-3 px-1" data-delivery-rail>
      <div className="flex items-center">
        {RAIL_STAGES.map((stage, index) => {
          const complete = index < reached;
          const isDelaySegment = delayed && index === RAIL_STAGES.length - 1;
          return (
            <Fragment key={stage}>
              {index > 0 ? (
                <div
                  className={`relative h-1 flex-1 rounded-full ${
                    index < reached
                      ? "bg-emerald-600"
                      : isDelaySegment
                        ? "bg-amber-500/50"
                        : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                >
                  {isDelaySegment ? (
                    <span
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400"
                      title="The original delivery estimate was missed"
                    >
                      delayed
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  complete
                    ? "bg-emerald-600 text-white"
                    : index === reached
                      ? "border-2 border-emerald-600 bg-body dark:bg-darkmode-body"
                      : "border-2 border-neutral-300 bg-body dark:border-neutral-600 dark:bg-darkmode-body"
                }`}
                aria-hidden
              >
                {complete ? "✓" : ""}
              </div>
            </Fragment>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] leading-tight">
        {RAIL_STAGES.map((stage, index) => {
          const complete = index < reached;
          const last = index === RAIL_STAGES.length - 1;
          return (
            <div
              key={stage}
              className={`${index === 0 ? "text-left" : last ? "text-right" : "text-center"} ${
                complete
                  ? "font-semibold text-text-dark dark:text-white"
                  : "text-text-light dark:text-darkmode-text-light"
              }`}
            >
              <div>{stage}</div>
              {index === 0 && order.placed_at ? (
                <div className="font-normal text-text-light dark:text-darkmode-text-light">
                  {shortDay(order.placed_at)}
                </div>
              ) : null}
              {last && deliveredOn ? (
                <div className="font-normal text-text-light dark:text-darkmode-text-light">
                  {shortDay(deliveredOn)}
                </div>
              ) : null}
              {last && !deliveredOn && estimate ? (
                <div className="font-normal">
                  {original ? (
                    <s className="text-text-light dark:text-darkmode-text-light">
                      {shortDay(original)}
                    </s>
                  ) : null}{" "}
                  <span
                    className={
                      original
                        ? "font-bold text-amber-700 dark:text-amber-400"
                        : "text-text-light dark:text-darkmode-text-light"
                    }
                  >
                    {shortDay(estimate)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      <DeliveryRail order={order} />
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
      {order.estimated_delivery && RAIL_PROGRESS[status] == null ? (
        // The rail shows the estimate for its own statuses; this line covers the rest.
        <p className="mt-2 px-1 text-sm text-text-light dark:text-darkmode-text-light">
          Estimated delivery: {new Date(order.estimated_delivery).toLocaleDateString()}
        </p>
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
