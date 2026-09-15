import { customerToken, refuseUnlessInternal } from "@/lib/assistant/internal";
import { toAgentOrder, toAgentPreferences } from "@/lib/assistant/shapes";
import { getCustomerOrders } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

const MAX_ORDERS = 50;

/**
 * The signed-in customer's profile and their own orders.
 *
 * Shopify reaches an order only through its customer, which is what keeps another
 * customer's order unreachable. A 401 here is not an outage: it means the session is a
 * guest, or its token expired, and the agent turns it into an offer to sign in.
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const token = customerToken(request);
  if (!token) {
    return NextResponse.json({ reason: "sign_in_required" }, { status: 401 });
  }

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit")) || 20, 1),
    MAX_ORDERS,
  );
  const customer = await getCustomerOrders(token, limit).catch(() => null);
  if (!customer) {
    return NextResponse.json({ reason: "sign_in_required" }, { status: 401 });
  }

  return NextResponse.json({
    preferences: toAgentPreferences(customer),
    orders: customer.orders.map(toAgentOrder),
  });
}
