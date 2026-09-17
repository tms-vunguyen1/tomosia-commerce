import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import {
  PRODUCT_FIELDS,
  productToListingDetails,
  variantToListingDetails,
  type ShopifyProduct,
} from "@/lib/merchant-assistant/shapes";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

type NodeResult =
  | { __typename: "Product" }
  | { __typename: "ProductVariant"; product: ShopifyProduct }
  | null;

/**
 * One listing's full record, by a product id (a plain listing or a family) or a
 * variant id — "on a variant's id return that variant"
 * (merchant_agent.backend.MerchantBackend's docstring).
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ detail: "id is required" }, { status: 400 });
  }

  const data = await adminGraphQL<{ node: (NodeResult & ShopifyProduct) | null }>(
    `query($id: ID!) {
      node(id: $id) {
        __typename
        ... on Product { ${PRODUCT_FIELDS} }
        ... on ProductVariant { id product { ${PRODUCT_FIELDS} } }
      }
    }`,
    { id },
  );
  if (!data.node) {
    return NextResponse.json({ detail: "Unknown listing" }, { status: 404 });
  }
  if (data.node.__typename === "Product") {
    return NextResponse.json(productToListingDetails(data.node));
  }
  const product = (data.node as unknown as { product: ShopifyProduct }).product;
  const variant = product.variants.nodes.find((v) => v.id === id);
  if (!variant) {
    return NextResponse.json({ detail: "Unknown listing" }, { status: 404 });
  }
  return NextResponse.json(variantToListingDetails(product, variant));
}
