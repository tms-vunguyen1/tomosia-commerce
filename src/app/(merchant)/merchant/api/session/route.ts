import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/lib/merchant/auth";
import {
  merchantAssistantUrl,
  merchantInternalHeaders,
  MissingConfiguration,
} from "@/lib/merchant-assistant/service";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Starts the merchant agent's session — the one hop that carries a principal.
 *
 * The operator is never taken from the request body: this route reads the portal's own
 * login cookie server-side (the same one `(dashboard)/layout.tsx` gates pages on) and
 * resolves it to a `MerchantUser` itself, so a caller cannot start a session as anyone
 * but the operator already logged into this browser. The browser receives a session id
 * and nothing else; every later call carries that id alone (see `[...path]/route.ts`).
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_AUTH_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: { code: "UNKNOWN_CALLER" } }, { status: 401 });
  }

  let target: string;
  let headers: Record<string, string>;
  try {
    target = merchantAssistantUrl("/api/session");
    headers = merchantInternalHeaders();
  } catch (error) {
    if (!(error instanceof MissingConfiguration)) throw error;
    return NextResponse.json({ error: { code: "CONFIG_MISSING" } }, { status: 503 });
  }

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: user.id, operator: user.name }),
  }).catch(() => null);

  if (!upstream?.ok) {
    return NextResponse.json(
      { error: { code: "ASSISTANT_UNREACHABLE" } },
      { status: 503 },
    );
  }
  const started = await upstream.json();
  return NextResponse.json({ session_id: started.session_id, operator: user.name });
}
