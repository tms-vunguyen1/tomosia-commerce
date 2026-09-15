import { refuseUnlessInternal, searchPolicies } from "@/lib/assistant/internal";
import { NextRequest, NextResponse } from "next/server";

/**
 * The store's help and policy pages. They are the storefront's own markdown under
 * `src/content/`, so the assistant quotes exactly what the site shows.
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const query = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ policies: searchPolicies(query) });
}
