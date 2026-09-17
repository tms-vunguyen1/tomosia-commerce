import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import {
  PRODUCT_FIELDS,
  productToListingDetails,
  type ShopifyProduct,
} from "@/lib/merchant-assistant/shapes";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

const MAX_LIMIT = 100;

/**
 * Listing search for the merchant agent. A family is one result (its `variants` array
 * still carries the per-variant rows, since the agent's provenance record needs them
 * too — see ``merchant_agent``'s docstring on ``MerchantBackend``).
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 8, 1), MAX_LIMIT);

  const data = await adminGraphQL<{ products: { nodes: ShopifyProduct[] } }>(
    `query($first: Int!, $query: String) {
      products(first: $first, query: $query, sortKey: TITLE) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }`,
    { first: limit, query: query || null },
  );
  return NextResponse.json({ listings: data.products.nodes.map(productToListingDetails) });
}
