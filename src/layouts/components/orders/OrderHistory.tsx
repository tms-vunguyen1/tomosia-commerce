import Price from "@/components/Price";

export type OrderSummary = {
  id: string;
  name: string;
  processedAt: string;
  fulfillmentStatus: string | null;
  statusUrl: string | null;
  currentTotalPrice: { amount: string; currencyCode: string };
  successfulFulfillments: { trackingInfo: { url: string | null }[] }[] | null;
  lineItems: { title: string; quantity: number }[];
};

export default function OrderHistory({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-text-dark/70 dark:text-darkmode-text-dark/70">
        You haven&apos;t placed any orders yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: OrderSummary }) {
  const tracking = order.successfulFulfillments?.[0]?.trackingInfo?.[0]?.url;

  return (
    <div className="rounded-xl border border-border p-5 dark:border-darkmode-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{order.name}</p>
          <p className="text-xs text-text-dark/60 dark:text-darkmode-text-dark/60">
            {new Date(order.processedAt).toLocaleDateString()}
          </p>
        </div>
        <Price
          amount={order.currentTotalPrice.amount}
          currencyCode={order.currentTotalPrice.currencyCode}
          className="font-medium"
        />
      </div>

      <ul className="mt-3 space-y-1 text-sm text-text-dark/80 dark:text-darkmode-text-dark/80">
        {order.lineItems.map((item, i) => (
          <li key={i}>
            {item.quantity} × {item.title}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/10">
          {order.fulfillmentStatus ?? "UNFULFILLED"}
        </span>
        {tracking && (
          <a
            href={tracking}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Track shipment
          </a>
        )}
        {order.statusUrl && (
          <a
            href={order.statusUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View full receipt
          </a>
        )}
      </div>
    </div>
  );
}
