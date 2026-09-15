import { refuseUnlessInternal } from "@/lib/assistant/internal";
import {
  buildSearchQuery,
  toAgentProduct,
  type AgentSearchFilters,
} from "@/lib/assistant/shapes";
import { getProducts } from "@/lib/shopify";
import { NextRequest, NextResponse } from "next/server";

const MAX_LIMIT = 25;

/**
 * Catalogue search for the assistant. The agent sends the customer's words and whatever
 * filters it inferred; the Shopify search string is built here, so the query language
 * lives in one place with the rest of the storefront's.
 */
export async function POST(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    filters?: AgentSearchFilters | null;
    limit?: number;
  };
  const limit = Math.min(Math.max(Number(body.limit) || 8, 1), MAX_LIMIT);
  const { query, sortKey, reverse } = buildSearchQuery(
    body.query ?? "",
    body.filters,
  );

  const { products } = await getProducts({ query, sortKey, reverse });
  return NextResponse.json({
    products: products.slice(0, limit).map(toAgentProduct),
  });
}
