import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MERCHANT_AUTH_COOKIE, MERCHANT_AUTH_COOKIE_OPTIONS } from "@/lib/constants";
import { deleteSession } from "@/lib/merchant/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_AUTH_COOKIE)?.value;

  if (token) {
    await deleteSession(token);
  }
  // Deleting with the same path it was set with — the cookie was scoped to
  // /merchant, and a delete without a matching path leaves it behind.
  cookieStore.delete({
    name: MERCHANT_AUTH_COOKIE,
    path: MERCHANT_AUTH_COOKIE_OPTIONS.path,
  });

  return NextResponse.json({ success: true });
}
