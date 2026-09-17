import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import { resolveProductId } from "@/lib/merchant-assistant/shapes";
import { adminGraphQL } from "@/lib/shopify/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Restock (a quantity delta on the variant's inventory item, at the store's one
 * location) or pause/activate (the parent product's status — Shopify has no
 * per-variant "active" flag, so a variant id here resolves up to its product).
 *
 * `action` is one of "restock" (with `quantity` as the signed delta the agent already
 * computed), "active", or "paused" (`merchant_assistant.backend.ShopifyMerchant` sends
 * the target status string directly, not a verb).
 */
export async function POST(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const body = (await request.json().catch(() => ({}))) as {
    listing_id?: string;
    action?: string;
    quantity?: number | null;
  };
  const listingId = String(body.listing_id || "");
  const action = String(body.action || "");
  if (!listingId || !action) {
    return NextResponse.json({ detail: "listing_id and action are required" }, { status: 400 });
  }

  if (action === "restock") {
    return restock(listingId, Number(body.quantity) || 0);
  }
  if (action === "active" || action === "paused") {
    return setStatus(listingId, action === "active" ? "ACTIVE" : "DRAFT");
  }
  return NextResponse.json({ detail: `Unknown inventory action ${action}` }, { status: 409 });
}

async function restock(variantId: string, delta: number): Promise<NextResponse> {
  const lookup = await adminGraphQL<{
    productVariant: { inventoryItem: { id: string } } | null;
  }>(`query($id: ID!) { productVariant(id: $id) { inventoryItem { id } } }`, { id: variantId });
  if (!lookup.productVariant) {
    return NextResponse.json({ detail: `Unknown variant ${variantId}` }, { status: 409 });
  }
  const locations = await adminGraphQL<{ locations: { nodes: { id: string }[] } }>(
    `query { locations(first: 1) { nodes { id } } }`,
  );
  const locationId = locations.locations.nodes[0]?.id;
  if (!locationId) {
    return NextResponse.json({ detail: "This store has no fulfillment location" }, { status: 409 });
  }
  const result = await adminGraphQL<{
    inventoryAdjustQuantities: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        reason: "correction",
        name: "available",
        changes: [
          { inventoryItemId: lookup.productVariant.inventoryItem.id, locationId, delta },
        ],
      },
    },
  );
  const errors = result.inventoryAdjustQuantities.userErrors;
  if (errors.length) {
    return NextResponse.json({ detail: errors.map((e) => e.message).join("; ") }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

async function setStatus(id: string, status: "ACTIVE" | "DRAFT"): Promise<NextResponse> {
  const productId = await resolveProductId(id);
  if (!productId) {
    return NextResponse.json({ detail: `Unknown listing ${id}` }, { status: 409 });
  }
  const result = await adminGraphQL<{
    productUpdate: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation($product: ProductUpdateInput!) {
      productUpdate(product: $product) { userErrors { field message } }
    }`,
    { product: { id: productId, status } },
  );
  const errors = result.productUpdate.userErrors;
  if (errors.length) {
    return NextResponse.json({ detail: errors.map((e) => e.message).join("; ") }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

