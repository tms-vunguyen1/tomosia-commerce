import { customerToken, refuseUnlessInternal } from "@/lib/assistant/internal";
import { toAgentFulfillmentOptions } from "@/lib/assistant/shapes";
import {
  addCartDeliveryAddress,
  getCartDeliveryOptions,
  getCustomerOrders,
} from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

/**
 * Delivery, pickup and shipping options for the session's cart.
 *
 * Shopify only quotes shipping against an address, and this chat collects none, so the
 * only address available is the signed-in customer's own default one. A guest, or a
 * customer with none on file, gets `{"reason": "no_address"}` — not an error, just
 * nothing to quote — which the agent turns into an offer to sign in or add an address,
 * the same way a guest's order history does.
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const cartId = request.nextUrl.searchParams.get("cart_id");
  if (!cartId) {
    return NextResponse.json({ options: [] });
  }

  const token = customerToken(request);
  const address = token ? (await getCustomerOrders(token, 1).catch(() => null))?.defaultAddress : null;
  if (!address) {
    return NextResponse.json({ reason: "no_address" }, { status: 409 });
  }

  try {
    await addCartDeliveryAddress(cartId, {
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      company: address.company,
      countryCode: address.countryCodeV2,
      provinceCode: address.provinceCode,
      zip: address.zip,
    });
  } catch {
    // The address on file doesn't resolve to a shipping zone Shopify can quote.
    return NextResponse.json({ reason: "no_address" }, { status: 409 });
  }

  const options = await getCartDeliveryOptions(cartId);
  return NextResponse.json({ options: toAgentFulfillmentOptions(options) });
}
