"use server";

import { TAGS } from "@/lib/constants";
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCart,
  updateCartBuyerIdentity,
} from "@/lib/shopify";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";

/**
 * Attaches the logged-in customer to the cart so Shopify's checkout opens
 * already authenticated, with email/address prefilled and the order tied to
 * the customer account. No-op for guests.
 */
export async function attachCustomerToCart(cartId?: string) {
  const cookieStore = await cookies();
  const id = cartId ?? cookieStore.get("cartId")?.value;
  const customerAccessToken = cookieStore.get("token")?.value;

  if (!id || !customerAccessToken) {
    return;
  }

  try {
    await updateCartBuyerIdentity(id, customerAccessToken);
    revalidateTag(TAGS.cart, "max");
  } catch (e) {
    console.error("Error attaching customer to cart:", e);
  }
}

export async function addItem(
  prevState: any,
  selectedVariantId: string | undefined,
) {
  let cartId = (await cookies()).get("cartId")?.value;
  let cart;

  if (cartId) {
    cart = await getCart(cartId);
  }

  if (!cartId || !cart) {
    cart = await createCart();
    cartId = cart.id;
    (await cookies()).set("cartId", cartId);
    await attachCustomerToCart(cartId);
  }

  if (!selectedVariantId) {
    return "Missing product variant ID";
  }

  try {
    await addToCart(cartId, [
      { merchandiseId: selectedVariantId, quantity: 1 },
    ]);
    revalidateTag(TAGS.cart, "max");
  } catch (e) {
    return `Error adding item to cart: ${e}`;
  }
}

export async function removeItem(prevState: any, lineId: string) {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    return "Missing cart ID";
  }

  try {
    await removeFromCart(cartId, [lineId]);
    revalidateTag(TAGS.cart, "max");
  } catch (e) {
    return `Error removing item from cart: ${e}`;
  }
}

export async function updateItemQuantity(
  prevState: any,
  payload: { lineId: string; variantId: string; quantity: number },
) {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    return "Missing cart ID";
  }

  const { lineId, variantId, quantity } = payload;

  try {
    if (quantity === 0) {
      await removeFromCart(cartId, [lineId]);
      revalidateTag(TAGS.cart, "max");
      return;
    }

    await updateCart(cartId, [
      { id: lineId, merchandiseId: variantId, quantity },
    ]);
    revalidateTag(TAGS.cart, "max");
  } catch (e) {
    return `Error updating item quantity: ${e}`;
  }
}
