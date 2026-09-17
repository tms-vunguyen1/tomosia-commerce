import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: { nodes: { title: string; quantity: number }[] };
}

/**
 * Real orders, newest first — used for the recent-orders list and for deriving
 * order-health issues (`merchant_assistant.backend.ShopifyMerchant.get_order_issues`).
 * Shopify has no "order issue" object of its own; a delayed shipment is the only kind
 * derivable from order fields alone (unfulfilled + old enough), so that is all this
 * feeds — return_spike/buyer_message/damaged would need the Returns API and Shopify
 * Inbox, neither wired here.
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 100);
  const unfulfilledOnly = searchParams.get("unfulfilled_only") === "true";

  const data = await adminGraphQL<{ orders: { nodes: ShopifyOrder[] } }>(
    `query($first: Int!, $query: String) {
      orders(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {
        nodes {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 5) { nodes { title quantity } }
        }
      }
    }`,
    { first: limit, query: unfulfilledOnly ? "fulfillment_status:unfulfilled" : null },
  );

  const orders = data.orders.nodes.map((order) => ({
    order_id: order.name,
    status: order.displayFulfillmentStatus.toLowerCase(),
    financial_status: order.displayFinancialStatus.toLowerCase(),
    placed_at: order.createdAt,
    total: Number(order.currentTotalPriceSet.shopMoney.amount),
    currency: order.currentTotalPriceSet.shopMoney.currencyCode,
    items: order.lineItems.nodes.reduce((sum, item) => sum + item.quantity, 0),
    line_item_titles: order.lineItems.nodes.map((item) => item.title),
  }));
  return NextResponse.json({ orders });
}
