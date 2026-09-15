import { ErrorCode } from "@/lib/assistant/errors";
import {
  ASSISTANT_SESSION_HEADER,
  assistantUrl,
  internalHeaders,
  MissingConfiguration,
} from "@/lib/assistant/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * Everything the modal calls after its session has started, forwarded to the agent
 * service. The service is not exposed to the internet; this is its only door.
 *
 * Exactly one header crosses from the browser — the session id, which is the request's
 * whole credential. Nothing else is forwarded, so a page cannot borrow the internal
 * secret or name a customer. `/api/assistant/session` is a route of its own and never
 * reaches here.
 */

// The chat turn is Server-Sent Events: the body is piped through as it arrives.
export const dynamic = "force-dynamic";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path[0] === "session") {
    // Unreachable from this app's own client: /api/assistant/session resolves to its
    // own route file first. Kept only so a stray deeper path fails cleanly.
    return NextResponse.json(
      { error: { code: ErrorCode.ASSISTANT_UNREACHABLE } },
      { status: 404 },
    );
  }

  let headers: Record<string, string>;
  let target: string;
  try {
    headers = internalHeaders();
    target = assistantUrl(`/api/${path.join("/")}${request.nextUrl.search}`);
  } catch (error) {
    if (!(error instanceof MissingConfiguration)) throw error;
    return NextResponse.json(
      { error: { code: ErrorCode.CONFIG_MISSING } },
      { status: 503 },
    );
  }
  const session = request.headers.get(ASSISTANT_SESSION_HEADER);
  if (session) headers["X-Session-Id"] = session;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: ErrorCode.ASSISTANT_UNREACHABLE } },
      { status: 503 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
