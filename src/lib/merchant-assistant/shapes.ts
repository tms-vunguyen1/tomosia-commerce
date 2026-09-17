/**
 * Shopify Admin API records, reshaped into the merchant agent's own `Listing`/
 * `ListingDetails` shapes (`merchant_agent.types`). Mirrors what `src/lib/assistant/
 * shapes.ts` does for the shopping agent's `Product`, one system earlier: every Admin
 * API field name lives here, once, so `merchant-agent/merchant_assistant/backend.py`
 * only ever sees the agent's own shape.
 *
 * Currency is hardcoded to this store's own (USD), matching every other fixture and
 * config in this repo — Shopify's variant price is a bare amount with no currency code
 * attached, and a single-store deployment has exactly one to read from Shop.currencyCode
 * for, which isn't worth the extra round trip here.
 */

import { adminGraphQL } from "@/lib/shopify/admin";

const CURRENCY = "USD";

/** Shopify's `descriptionHtml` is markup meant for the storefront to render; the agent
 * and the portal's listing sheet both just want to read it, so strip tags down to plain
 * text (decoding the handful of entities Shopify's own rich-text editor emits) rather
 * than showing raw HTML or piping it through `dangerouslySetInnerHTML`. */
function plainTextFromHtml(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** A plain listing is served under its variant id (see `isPlainProduct`), but every
 * Shopify write that touches the parent product (status, title, description, category)
 * needs the *product* id — resolve one up from the other when needed. */
export async function resolveProductId(id: string): Promise<string | null> {
  if (id.includes("/Product/")) return id;
  const data = await adminGraphQL<{ productVariant: { product: { id: string } } | null }>(
    `query($id: ID!) { productVariant(id: $id) { product { id } } }`,
    { id },
  );
  return data.productVariant?.product.id ?? null;
}

export const PRODUCT_FIELDS = `
  id
  title
  status
  productType
  descriptionHtml
  featuredImage { url }
  options { name values }
  variants(first: 100) {
    nodes {
      id
      title
      price
      inventoryQuantity
      selectedOptions { name value }
      inventoryItem { id unitCost { amount } }
    }
  }
`;

export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  inventoryQuantity: number | null;
  selectedOptions: { name: string; value: string }[];
  inventoryItem: { id: string; unitCost: { amount: string } | null } | null;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  productType: string | null;
  descriptionHtml: string | null;
  featuredImage: { url: string } | null;
  options: { name: string; values: string[] }[];
  variants: { nodes: ShopifyVariant[] };
}

/** A product whose only option is Title: Default Title is plain and is served under its
 * variant id (../../../CLAUDE.md's catalog-shape convention, shared with the storefront). */
export function isPlainProduct(product: ShopifyProduct): boolean {
  return (
    product.variants.nodes.length === 1 &&
    product.options.length === 1 &&
    product.options[0].name === "Title" &&
    product.options[0].values[0] === "Default Title"
  );
}

function statusFor(shopifyStatus: ShopifyProduct["status"], stock: number): string {
  if (shopifyStatus !== "ACTIVE") return "paused";
  return stock > 0 ? "active" : "out_of_stock";
}

function variantRow(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  variantOf: string | null,
) {
  const stock = variant.inventoryQuantity ?? 0;
  return {
    listing_id: variant.id,
    title: product.title,
    status: statusFor(product.status, stock),
    price: Number(variant.price),
    currency: CURRENCY,
    stock,
    category: product.productType || null,
    content_quality: null,
    attributes: {},
    image_url: product.featuredImage?.url ?? null,
    short_description: null,
    options: {},
    option_values: Object.fromEntries(
      variant.selectedOptions.map((option) => [option.name, option.value]),
    ),
    variant_of: variantOf,
    unit_cost: variant.inventoryItem?.unitCost
      ? Number(variant.inventoryItem.unitCost.amount)
      : null,
  };
}

function familyRow(product: ShopifyProduct) {
  const variants = product.variants.nodes.map((v) => variantRow(product, v, product.id));
  const stock = variants.reduce((sum, v) => sum + v.stock, 0);
  const price = Math.min(...variants.map((v) => v.price));
  const anyActive = variants.some((v) => v.status === "active");
  return {
    listing_id: product.id,
    title: product.title,
    status: product.status !== "ACTIVE" ? "paused" : anyActive ? "active" : "out_of_stock",
    price,
    currency: CURRENCY,
    stock,
    category: product.productType || null,
    content_quality: null,
    attributes: {},
    image_url: product.featuredImage?.url ?? null,
    short_description: null,
    options: Object.fromEntries(product.options.map((o) => [o.name, o.values])),
    option_values: {},
    variant_of: null,
    unit_cost: null, // cost lives on each variant for a family
  };
}

/** Full detail for a product id: a plain listing (served under its one variant's id), or
 * a family row with one `variants` entry per Shopify variant. */
export function productToListingDetails(product: ShopifyProduct) {
  if (isPlainProduct(product)) {
    const row = variantRow(product, product.variants.nodes[0], null);
    return {
      ...row,
      long_description: plainTextFromHtml(product.descriptionHtml),
      review_snippets: [] as string[],
      sales_last_30d: null,
      return_rate_pct: null,
      missing_attributes: [] as string[],
      variants: [] as unknown[],
    };
  }
  const row = familyRow(product);
  return {
    ...row,
    long_description: plainTextFromHtml(product.descriptionHtml),
    review_snippets: [] as string[],
    sales_last_30d: null,
    return_rate_pct: null,
    missing_attributes: [] as string[],
    variants: product.variants.nodes.map((v) => variantRow(product, v, product.id)),
  };
}

/** Detail for one variant within its parent product — "on a variant's id return that
 * variant" (merchant_agent.backend.MerchantBackend's docstring). */
export function variantToListingDetails(product: ShopifyProduct, variant: ShopifyVariant) {
  const row = variantRow(product, variant, product.id);
  return {
    ...row,
    long_description: plainTextFromHtml(product.descriptionHtml),
    review_snippets: [] as string[],
    sales_last_30d: null,
    return_rate_pct: null,
    missing_attributes: [] as string[],
    variants: [] as unknown[],
  };
}
