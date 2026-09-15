import { AUTH_COOKIE, TAGS } from "@/lib/constants";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE);
  // The cart is attached to the customer that just logged out, so leaving it
  // behind would hand their items and their checkout identity to whoever uses
  // this browser next. Dropping the id starts the next visitor on a fresh cart.
  cookieStore.delete("cartId");

  revalidateTag(TAGS.cart, "max");

  return NextResponse.json({ success: true });
}
