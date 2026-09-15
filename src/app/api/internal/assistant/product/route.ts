import { refuseUnlessInternal } from "@/lib/assistant/internal";
import { toAgentProductDetails } from "@/lib/assistant/shapes";
import { getProductById } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

/**
 * One product or variant by its global id. An id Shopify does not know is a 404, which
 * the agent reads as "no product with that id" rather than as a failure — the model
 * wrote the id, so a miss is an ordinary outcome.
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id.startsWith("gid://shopify/")) {
    return NextResponse.json({ detail: "Unknown product" }, { status: 404 });
  }

  const found = await getProductById(id).catch(() => undefined);
  if (!found) {
    return NextResponse.json({ detail: "Unknown product" }, { status: 404 });
  }
  return NextResponse.json(
    toAgentProductDetails(found.product, found.variantId),
  );
}
