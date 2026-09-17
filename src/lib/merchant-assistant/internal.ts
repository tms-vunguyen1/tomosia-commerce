/**
 * The guard every route under `src/app/api/internal/merchant/` uses. These routes are
 * the merchant agent's view of Shopify's Admin API: called by the agent service, server
 * to server, never by a browser. Mirrors src/lib/assistant/internal.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "./service";

export const INTERNAL_HEADER = "x-internal-token";

/** A response to send when the caller isn't the merchant agent, or null when it is. */
export function refuseUnlessInternal(request: NextRequest): NextResponse | null {
  let expected: string;
  try {
    expected = requireEnv("MERCHANT_ASSISTANT_INTERNAL_TOKEN");
  } catch {
    return NextResponse.json({ error: { code: "CONFIG_MISSING" } }, { status: 503 });
  }
  if (request.headers.get(INTERNAL_HEADER) !== expected) {
    return NextResponse.json({ error: { code: "UNKNOWN_CALLER" } }, { status: 401 });
  }
  return null;
}
