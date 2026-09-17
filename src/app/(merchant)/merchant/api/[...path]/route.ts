import {
  MERCHANT_SESSION_HEADER,
  merchantAssistantUrl,
  merchantInternalHeaders,
  MissingConfiguration,
} from "@/lib/merchant-assistant/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Everything the portal's assistant rail calls after its session has started, forwarded
 * to the merchant agent service. Mirrors `src/app/api/assistant/[...path]/route.ts`.
 *
 * Exactly one header crosses from the browser — the session id, which is the request's
 * whole credential. `/merchant/api/session` is a route of its own and never reaches here.
 */

// The chat turn is Server-Sent Events: the body is piped through as it arrives.
export const dynamic = "force-dynamic";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path[0] === "session") {
    return NextResponse.json({ error: { code: "ASSISTANT_UNREACHABLE" } }, { status: 404 });
  }

  let headers: Record<string, string>;
  let target: string;
  try {
    headers = merchantInternalHeaders();
    target = merchantAssistantUrl(`/api/${path.join("/")}${request.nextUrl.search}`);
  } catch (error) {
    if (!(error instanceof MissingConfiguration)) throw error;
    return NextResponse.json({ error: { code: "CONFIG_MISSING" } }, { status: 503 });
  }
  const session = request.headers.get(MERCHANT_SESSION_HEADER);
  if (session) headers["X-Session-Id"] = session;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const upstream = await fetch(target, { method: request.method, headers, body }).catch(
    () => null,
  );

  if (!upstream) {
    return NextResponse.json({ error: { code: "ASSISTANT_UNREACHABLE" } }, { status: 503 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
