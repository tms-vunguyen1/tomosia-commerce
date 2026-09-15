import { ErrorCode } from "@/lib/assistant/errors";
import { toAgentProductDetails } from "@/lib/assistant/shapes";
import { getProductById } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

/**
 * The full record behind a product the assistant already showed, for the card that
 * unfolds under it: long description, specs, and the family's variants.
 *
 * Unlike everything else under `/api/assistant`, this does not touch the agent — it is
 * the same public catalogue the storefront's own product pages render, in the shapes the
 * cards already speak. Nothing here is a cart write, so no gate is skipped by reading it;
 * adding a variant still goes back through the conversation.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id.startsWith("gid://shopify/")) {
    return NextResponse.json(
      { error: { code: ErrorCode.PRODUCT_NOT_FOUND } },
      { status: 404 },
    );
  }

  const found = await getProductById(id).catch(() => undefined);
  if (!found) {
    return NextResponse.json(
      { error: { code: ErrorCode.PRODUCT_NOT_FOUND } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    toAgentProductDetails(found.product, found.variantId),
  );
}
