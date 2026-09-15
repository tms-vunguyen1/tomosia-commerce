/**
 * The shopping assistant's record shapes, and the mapping from Shopify's onto them.
 *
 * This is the single place where the storefront's data becomes what the agent reads.
 * The agent's Python backend calls the internal routes under
 * `src/app/api/internal/assistant/` and validates the JSON below straight into
 * `shopping_agent.types`, so the field names here are the Python ones (snake_case) and a
 * change to either side has to be made here.
 *
 * The mapping rules come from `docs/backends.md` of anthropics/commerce-agents, step 4:
 *
 * - A product with nothing to choose is **plain** and is served under its single
 *   variant's id, because that is the id the cart takes.
 * - A product with real options is a **family** under the product's own id; its variants
 *   carry their own id, price, stock, `option_values` and `variant_of`.
 * - A family's storefront price is its lowest in-stock variant's, and it is in stock
 *   while any variant is.
 * - A figure Shopify cannot supply is `null`, never a stand-in zero.
 */

import { DEFAULT_OPTION } from "@/lib/constants";
import type {
  Cart,
  Money,
  Product,
  ProductVariant,
  ShopifyCustomerWithOrders,
  ShopifyDeliveryOption,
} from "@/lib/shopify/types";

/**
 * Variants returned inside one family record. The agent fences a tool result at 12,000
 * characters and a compact variant row is 70-120 of them, so about sixty fit; fifty
 * leaves headroom for the family's own fields. A larger matrix has to be split by its
 * leading option in Shopify.
 */
export const MAX_VARIANTS = 50;

export interface AgentProduct {
  product_id: string;
  title: string;
  brand: string | null;
  price: number;
  currency: string;
  rating: null;
  review_count: null;
  image_url: string | null;
  category: string | null;
  labels: string[];
  in_stock: boolean;
  short_description: string | null;
  options?: Record<string, string[]>;
  option_values?: Record<string, string>;
  variant_of?: string | null;
}

export interface AgentProductDetails extends AgentProduct {
  long_description: string | null;
  variants?: AgentProduct[];
}

export interface AgentCartLine {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string | null;
  option_values: Record<string, string>;
  variant_of: string | null;
}

export interface AgentCart {
  items: AgentCartLine[];
  currency: string;
  /** Shopify's hosted checkout for this cart; the agent hands it to its checkout card. */
  checkout_url: string | null;
}

export interface AgentOrder {
  order_id: string;
  status: string;
  placed_at: string;
  items: {
    product_id: string;
    title: string;
    quantity: number;
    price: number;
    option_values: Record<string, string>;
    variant_of: string | null;
  }[];
  total: number;
  currency: string;
  tracking_url: string | null;
}

export interface AgentPreferences {
  display_name: string | null;
  default_location: string | null;
}

export interface AgentPolicy {
  policy_id: string;
  title: string;
  category: string | null;
  content: string;
}

export interface AgentSearchFilters {
  category?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  min_rating?: number | null;
  attributes?: Record<string, string>;
  sort?: string;
}

export interface AgentFulfillmentOption {
  method: "delivery" | "pickup" | "shipping";
  /** Shopify gives no structured ETA or pickup location, only this rate's own title
   * and (usually empty, at least for this store) description; whatever text the store
   * put there is what this carries — never an invented delivery date. */
  eta: string;
  fee: number;
  location?: string | null;
}

// -- Products ----------------------------------------------------------------------

function amount(money: Money | undefined): number {
  return money ? Number(money.amount) || 0 : 0;
}

function currencyOf(money: Money | undefined): string {
  return money?.currencyCode || "USD";
}

/** The product's options with Shopify's placeholder removed: a product with nothing to
 * choose reads as plain. */
function realOptions(product: Product): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (const option of product.options ?? []) {
    const values = (option.values ?? []).filter(
      (value) => value !== DEFAULT_OPTION,
    );
    if (values.length) options[option.name] = values;
  }
  return options;
}

function selectedOptions(
  variant: Pick<ProductVariant, "selectedOptions">,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const option of variant.selectedOptions ?? []) {
    if (option.value !== DEFAULT_OPTION) values[option.name] = option.value;
  }
  return values;
}

function baseFields(product: Product): Omit<AgentProduct, "product_id"> {
  return {
    title: product.title,
    brand: product.vendor || null,
    price: amount(product.priceRange?.minVariantPrice),
    currency: currencyOf(product.priceRange?.minVariantPrice),
    // Shopify's Storefront API carries no rating or review count. A stand-in number
    // would be a figure the model could quote at the customer.
    rating: null,
    review_count: null,
    image_url: product.featuredImage?.url ?? null,
    category: product.productType || null,
    labels: (product.tags ?? []).slice(0, 8),
    in_stock: Boolean(product.availableForSale),
    short_description: product.description || null,
  };
}

function variantRecord(
  variant: ProductVariant,
  product: Product,
  base: Omit<AgentProduct, "product_id">,
): AgentProduct {
  return {
    ...base,
    product_id: variant.id,
    price: amount(variant.price),
    currency: currencyOf(variant.price),
    in_stock: Boolean(variant.availableForSale),
    option_values: selectedOptions(variant),
    variant_of: product.id,
  };
}

/** One search result: a family, or a plain product under its variant's id. */
export function toAgentProduct(product: Product): AgentProduct {
  const base = baseFields(product);
  const options = realOptions(product);
  if (Object.keys(options).length) {
    return { ...base, product_id: product.id, options };
  }
  const variant = product.variants?.[0];
  if (!variant) {
    // Nothing purchasable; the id still resolves through the product route.
    return { ...base, product_id: product.id };
  }
  return {
    ...base,
    product_id: variant.id,
    price: amount(variant.price),
    currency: currencyOf(variant.price),
    in_stock: Boolean(variant.availableForSale),
  };
}

/**
 * The full record for one id. `variantId` is set when the id named a variant, and the
 * contract is that a variant's id returns that variant rather than its family.
 */
export function toAgentProductDetails(
  product: Product,
  variantId?: string,
): AgentProductDetails {
  const base = baseFields(product);
  // Shopify's plain-text rendering, not `descriptionHtml`: both the detail card and the
  // model read this as text, so markup would show up verbatim in one and eat tokens in
  // the other. The storefront's own product page is what renders the HTML version.
  const longDescription = product.description || null;

  if (variantId) {
    const variant = product.variants?.find((each) => each.id === variantId);
    if (variant) {
      return {
        ...variantRecord(variant, product, base),
        long_description: longDescription,
      };
    }
  }

  const options = realOptions(product);
  if (!Object.keys(options).length) {
    const variant = product.variants?.[0];
    return {
      ...base,
      product_id: variant?.id ?? product.id,
      price: variant ? amount(variant.price) : base.price,
      currency: variant ? currencyOf(variant.price) : base.currency,
      in_stock: variant ? Boolean(variant.availableForSale) : base.in_stock,
      long_description: longDescription,
    };
  }

  const variants = (product.variants ?? [])
    .slice(0, MAX_VARIANTS)
    .map((variant) => variantRecord(variant, product, base));
  const inStockPrices = variants
    .filter((variant) => variant.in_stock)
    .map((variant) => variant.price);

  return {
    ...base,
    product_id: product.id,
    options,
    // A family's price is its lowest in-stock variant's ("from" price).
    price: inStockPrices.length ? Math.min(...inStockPrices) : base.price,
    in_stock: inStockPrices.length > 0,
    long_description: longDescription,
    variants,
  };
}

/** The in-stock siblings an out-of-stock variant is refused in favour of, ids only. */
export function inStockSiblings(product: Product, variantId: string): string[] {
  return (product.variants ?? [])
    .filter((variant) => variant.availableForSale && variant.id !== variantId)
    .map((variant) => variant.id)
    .slice(0, 8);
}

// -- Search ------------------------------------------------------------------------

const SORT_KEYS: Record<string, { sortKey: string; reverse: boolean }> = {
  relevance: { sortKey: "RELEVANCE", reverse: false },
  price_asc: { sortKey: "PRICE", reverse: false },
  price_desc: { sortKey: "PRICE", reverse: true },
  // Shopify has no rating to sort by; best sellers is the nearest signal it does have.
  rating: { sortKey: "BEST_SELLING", reverse: false },
};

/**
 * The Storefront search string for one agent search. Domain dimensions arrive in
 * `filters.attributes` and are appended as free text: Shopify's full-text index covers
 * title, product type, vendor, tags and variant option values, which is where a bulb
 * base or a finish lives.
 */
export function buildSearchQuery(
  query: string,
  filters?: AgentSearchFilters | null,
): { query: string; sortKey: string; reverse: boolean } {
  const parts: string[] = [];
  const text = query.split(/\s+/).filter(Boolean).join(" ");
  if (text) parts.push(text);

  let sort = SORT_KEYS[filters?.sort ?? "relevance"] ?? SORT_KEYS.relevance;
  if (filters) {
    if (filters.category) parts.push(`product_type:"${filters.category}"`);
    if (filters.min_price != null) {
      parts.push(`variants.price:>=${filters.min_price}`);
    }
    if (filters.max_price != null) {
      parts.push(`variants.price:<=${filters.max_price}`);
    }
    for (const value of Object.values(filters.attributes ?? {})) {
      const cleaned = String(value).split(/\s+/).filter(Boolean).join(" ");
      if (cleaned) parts.push(cleaned);
    }
  }
  // Shopify cannot rank a query-less search by relevance.
  if (sort.sortKey === "RELEVANCE" && !text) {
    sort = SORT_KEYS.rating;
  }
  return { query: parts.join(" "), ...sort };
}

// -- Cart --------------------------------------------------------------------------

export function toAgentCart(cart: Cart | undefined): AgentCart {
  if (!cart) {
    return { items: [], currency: "USD", checkout_url: null };
  }
  const checkoutUrl = cart.checkoutUrl?.startsWith("https://")
    ? cart.checkoutUrl
    : null;
  return {
    currency: currencyOf(cart.cost?.subtotalAmount),
    checkout_url: checkoutUrl,
    items: (cart.lines ?? [])
      .filter((line) => line.merchandise?.id)
      .map((line) => ({
        product_id: line.merchandise.id,
        title: line.merchandise.product?.title || line.merchandise.title,
        // The agent multiplies price by quantity itself, so the line's unit price is
        // what it needs, not Shopify's line total.
        price:
          line.quantity > 0
            ? Number(
                (amount(line.cost?.totalAmount) / line.quantity).toFixed(2),
              )
            : 0,
        quantity: line.quantity,
        image_url: line.merchandise.product?.featuredImage?.url ?? null,
        option_values: selectedOptions(line.merchandise),
        variant_of: line.merchandise.product?.id ?? null,
      })),
  };
}

/** The cart line holding a variant; Shopify's update and remove name the line. */
export function cartLineId(
  cart: Cart | undefined,
  variantId: string,
): string | undefined {
  return cart?.lines?.find((line) => line.merchandise?.id === variantId)?.id;
}

// -- Customer and orders -----------------------------------------------------------

// Shopify reports payment and fulfilment separately; the agent's single status is the
// most specific of the two. A refund or a void is terminal and wins over fulfilment.
const FINANCIAL_STATUS: Record<string, string> = {
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "refunded",
  VOIDED: "cancelled",
};
const FULFILLMENT_STATUS: Record<string, string> = {
  FULFILLED: "shipped",
  PARTIALLY_FULFILLED: "shipped",
  IN_PROGRESS: "processing",
  OPEN: "processing",
  UNFULFILLED: "processing",
  PENDING_FULFILLMENT: "processing",
  SCHEDULED: "processing",
  ON_HOLD: "delayed",
  RESTOCKED: "cancelled",
};

type CustomerOrder = ShopifyCustomerWithOrders["orders"][number];

export function toAgentOrder(order: CustomerOrder): AgentOrder {
  const financial = (order.financialStatus ?? "").toUpperCase();
  const fulfillment = (order.fulfillmentStatus ?? "").toUpperCase();
  const tracking = (order.successfulFulfillments ?? [])
    .flatMap((fulfilment) => fulfilment.trackingInfo ?? [])
    .map((info) => info.url)
    .filter((url): url is string => Boolean(url));

  return {
    // The order's name ("#1001") is the id the customer reads on their receipt and
    // types back into the conversation.
    order_id: order.name,
    status:
      FINANCIAL_STATUS[financial] ??
      FULFILLMENT_STATUS[fulfillment] ??
      "processing",
    placed_at: order.processedAt,
    total: amount(order.currentTotalPrice),
    currency: currencyOf(order.currentTotalPrice),
    tracking_url: tracking[0] ?? order.statusUrl ?? null,
    items: (order.lineItems ?? []).map((line) => ({
      product_id: line.variant?.id ?? "",
      title: line.title,
      quantity: line.quantity,
      price: amount(line.variant?.price),
      option_values: line.variant ? selectedOptions(line.variant) : {},
      variant_of: line.variant?.product?.id ?? null,
    })),
  };
}

export function toAgentPreferences(
  customer: Pick<
    ShopifyCustomerWithOrders,
    "firstName" | "lastName" | "defaultAddress"
  >,
): AgentPreferences {
  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const location = [
    customer.defaultAddress?.city,
    customer.defaultAddress?.province,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    display_name: name || null,
    default_location: location || null,
  };
}

// -- Fulfillment ---------------------------------------------------------------------

// Shopify's DeliveryMethodType has more values (RETAIL, PICKUP_POINT, NONE) than the
// agent's three; NONE (no physical fulfillment, e.g. a gift card) has nothing useful to
// quote and is dropped rather than forced into one of the three.
const DELIVERY_METHOD: Record<string, AgentFulfillmentOption["method"] | null> =
  {
    SHIPPING: "shipping",
    LOCAL: "delivery",
    PICK_UP: "pickup",
    RETAIL: "pickup",
    PICKUP_POINT: "pickup",
    NONE: null,
  };

export function toAgentFulfillmentOptions(
  options: ShopifyDeliveryOption[],
): AgentFulfillmentOption[] {
  const mapped: AgentFulfillmentOption[] = [];
  for (const option of options) {
    const method = DELIVERY_METHOD[option.deliveryMethodType];
    if (!method) continue;
    mapped.push({
      method,
      eta: option.description || option.title || method,
      fee: amount(option.estimatedCost),
    });
  }
  return mapped;
}
