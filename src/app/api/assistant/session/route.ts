import { ErrorCode } from "@/lib/assistant/errors";
import {
  assistantUrl,
  internalHeaders,
  MissingConfiguration,
} from "@/lib/assistant/service";
import { AUTH_COOKIE } from "@/lib/constants";
import { createCart, getUserDetails } from "@/lib/shopify";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Starts the assistant's session — the one hop that carries a principal.
 *
 * The browser sends nothing but its time zone. Who the caller is comes from the cookies
 * this route reads server-side: the httpOnly customer access token, and the cart the
 * storefront header shows. Both go to the agent service and neither comes back: the
 * browser receives a session id, and every later request carries that alone.
 *
 * A shopper who signs in gets a new session, under their customer id instead of the
 * guest id derived from their cart.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    timezone?: string;
  };
  const cookieStore = await cookies();
  const customerAccessToken = cookieStore.get(AUTH_COOKIE)?.value;

  let cartId = cookieStore.get("cartId")?.value;
  if (!cartId) {
    // The agent never creates a cart: it is handed the storefront's, so an add made in
    // the conversation is in the shopper's bag when they close the modal.
    const cart = await createCart();
    cartId = cart.id;
    cookieStore.set("cartId", cartId);
  }

  let userId: string | undefined;
  if (customerAccessToken) {
    // A token that has expired leaves the session a guest rather than failing the start.
    const details = await getUserDetails(customerAccessToken).catch(() => null);
    userId = details?.customer?.id;
  }

  let target: string;
  let headers: Record<string, string>;
  try {
    target = assistantUrl("/api/session");
    headers = internalHeaders();
  } catch (error) {
    if (!(error instanceof MissingConfiguration)) throw error;
    return NextResponse.json(
      { error: { code: ErrorCode.CONFIG_MISSING } },
      { status: 503 },
    );
  }

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      cart_id: cartId,
      customer_access_token: userId ? customerAccessToken : undefined,
      // A zone the shopper's browser reported; the agent validates it as IANA.
      timezone:
        typeof body.timezone === "string"
          ? body.timezone.slice(0, 64)
          : undefined,
    }),
  }).catch(() => null);

  if (!upstream?.ok) {
    return NextResponse.json(
      { error: { code: ErrorCode.ASSISTANT_UNREACHABLE } },
      { status: 503 },
    );
  }
  const started = await upstream.json();
  return NextResponse.json({
    session_id: started.session_id,
    name: started.name ?? null,
    signed_in: Boolean(started.signed_in),
  });
}
