import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

/** The one place a staged price update reaches Shopify: `productVariantsBulkUpdate`
 * needs the parent product id, so this looks it up before writing. */
export async function POST(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const body = (await request.json().catch(() => ({}))) as {
    listing_id?: string;
    new_price?: number;
  };
  const listingId = String(body.listing_id || "");
  const newPrice = Number(body.new_price);
  if (!listingId || !Number.isFinite(newPrice) || newPrice <= 0) {
    return NextResponse.json(
      { detail: "listing_id and a positive new_price are required" },
      { status: 400 },
    );
  }

  const lookup = await adminGraphQL<{
    productVariant: { id: string; product: { id: string } } | null;
  }>(`query($id: ID!) { productVariant(id: $id) { id product { id } } }`, { id: listingId });
  if (!lookup.productVariant) {
    return NextResponse.json({ detail: `Unknown variant ${listingId}` }, { status: 409 });
  }

  const result = await adminGraphQL<{
    productVariantsBulkUpdate: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    {
      productId: lookup.productVariant.product.id,
      variants: [{ id: listingId, price: newPrice.toFixed(2) }],
    },
  );
  const errors = result.productVariantsBulkUpdate.userErrors;
  if (errors.length) {
    return NextResponse.json(
      { detail: errors.map((e) => e.message).join("; ") },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
