import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import { resolveProductId } from "@/lib/merchant-assistant/shapes";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

/** title/long_description/category → Shopify's title/descriptionHtml/productType. The
 * agent backend already refuses any other field and any variant target before this is
 * ever called (Shopify has no per-variant title, description, or product type). */
const FIELD_MAP: Record<string, string> = {
  title: "title",
  long_description: "descriptionHtml",
  category: "productType",
};

export async function POST(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const body = (await request.json().catch(() => ({}))) as {
    listing_id?: string;
    fields?: Record<string, unknown>;
  };
  const listingId = String(body.listing_id || "");
  const fields = body.fields || {};
  if (!listingId || Object.keys(fields).length === 0) {
    return NextResponse.json({ detail: "listing_id and fields are required" }, { status: 400 });
  }

  const productId = await resolveProductId(listingId);
  if (!productId) {
    return NextResponse.json({ detail: `Unknown listing ${listingId}` }, { status: 409 });
  }
  const input: Record<string, unknown> = { id: productId };
  for (const [name, value] of Object.entries(fields)) {
    const shopifyField = FIELD_MAP[name];
    if (!shopifyField) {
      return NextResponse.json({ detail: `'${name}' is not editable` }, { status: 409 });
    }
    input[shopifyField] = value;
  }

  const result = await adminGraphQL<{
    productUpdate: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation($product: ProductUpdateInput!) {
      productUpdate(product: $product) { userErrors { field message } }
    }`,
    { product: input },
  );
  const errors = result.productUpdate.userErrors;
  if (errors.length) {
    return NextResponse.json({ detail: errors.map((e) => e.message).join("; ") }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
