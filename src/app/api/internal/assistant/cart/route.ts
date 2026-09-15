import { refuseUnlessInternal } from "@/lib/assistant/internal";
import {
  cartLineId,
  inStockSiblings,
  toAgentCart,
} from "@/lib/assistant/shapes";
import { TAGS } from "@/lib/constants";
import {
  addToCart,
  getCart,
  getProductById,
  removeFromCart,
  updateCart,
} from "@/lib/shopify";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * The session's cart, and the three writes the agent makes to it.
 *
 * The cart is the one the storefront header shows: the agent is handed its id at session
 * start and never creates one, so an add made in the conversation is in the shopper's bag
 * when they close the modal. Nothing here places an order or moves money.
 */

export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const cartId = request.nextUrl.searchParams.get("cart_id") ?? "";
  if (!cartId) return NextResponse.json(toAgentCart(undefined));
  return NextResponse.json(toAgentCart(await getCart(cartId)));
}

export async function POST(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const body = (await request.json().catch(() => ({}))) as {
    cart_id?: string;
    op?: "add" | "update" | "remove";
    product_id?: string;
    quantity?: number;
  };
  const cartId = body.cart_id ?? "";
  const productId = body.product_id ?? "";
  const quantity = Math.max(Number(body.quantity) || 1, 1);
  if (!cartId) {
    return NextResponse.json({ detail: "No cart bound" }, { status: 409 });
  }

  if (body.op === "add") {
    const found = await getProductById(productId).catch(() => undefined);
    // A family id is a product shell: Shopify has nothing to add for it, and the agent's
    // own options gate holds the call before it gets here.
    if (!found?.variantId) {
      return NextResponse.json(
        { reason: "unknown_variant", detail: productId },
        { status: 404 },
      );
    }
    const variant = found.product.variants.find(
      (each) => each.id === found.variantId,
    );
    if (!variant?.availableForSale) {
      // Ids only, as the agent's contract asks: what is out, and what is in stock.
      const siblings = inStockSiblings(found.product, productId);
      return NextResponse.json(
        {
          reason: "unavailable",
          detail: siblings.length
            ? `${productId} is out of stock; in stock: ${siblings.join(", ")}`
            : `${productId} is out of stock and no other variant of it is in stock`,
        },
        { status: 409 },
      );
    }
    await addToCart(cartId, [{ merchandiseId: productId, quantity }]);
    revalidateTag(TAGS.cart, "max");
    return NextResponse.json(toAgentCart(await getCart(cartId)));
  }

  const cart = await getCart(cartId);
  const lineId = cartLineId(cart, productId);
  // A product the cart does not hold leaves the cart as it is.
  if (!lineId) return NextResponse.json(toAgentCart(cart));

  if (body.op === "remove" || quantity === 0) {
    await removeFromCart(cartId, [lineId]);
  } else if (body.op === "update") {
    await updateCart(cartId, [
      { id: lineId, merchandiseId: productId, quantity },
    ]);
  } else {
    return NextResponse.json({ detail: "Unknown op" }, { status: 400 });
  }
  revalidateTag(TAGS.cart, "max");
  return NextResponse.json(toAgentCart(await getCart(cartId)));
}
