/**
 * The assistant's wire protocol, mirroring the Python side.
 *
 * Events mirror `commerce_common/streaming.py`; the card payloads mirror what
 * `shopping_agent/enrichment.py` hands the host after it has joined the model's picks to
 * the session's catalog records. Field names are the Python ones (snake_case) because
 * these objects arrive as JSON and are not remapped.
 */

export type AgentEventType =
  | "text_delta"
  | "tool_call"
  | "tool_result"
  | "ui"
  | "ui_partial"
  | "cart_update"
  | "progress"
  | "turn_complete"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
}

/** `tool_call` data. `label` is the model's own words for the person waiting. */
export interface ToolCallData {
  tool: string;
  id: string;
  input: Record<string, unknown>;
  label?: string;
}

/** Mirrors `shopping_agent/types.py` Product. */
export interface AgentProduct {
  product_id: string;
  title: string;
  brand?: string | null;
  price: number;
  currency?: string;
  rating?: number | null;
  review_count?: number | null;
  image_url?: string | null;
  category?: string | null;
  labels?: string[];
  attributes?: Record<string, string>;
  in_stock?: boolean;
  short_description?: string | null;
  options?: Record<string, string[]>;
  option_values?: Record<string, string>;
  variant_of?: string | null;
}

/** What `/api/assistant/product` returns: the record plus what only the full read has. */
export interface AgentProductDetails extends AgentProduct {
  long_description?: string | null;
  specs?: Record<string, string>;
  review_highlights?: string[];
  variants?: AgentProduct[];
}

export interface AgentCartLine {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  line_total: number;
  image_url?: string | null;
  option_values?: Record<string, string>;
  variant_of?: string | null;
}

export interface AgentCart {
  items: AgentCartLine[];
  item_count: number;
  subtotal: number;
  currency: string;
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
    option_values?: Record<string, string>;
  }[];
  total: number;
  currency?: string;
  estimated_delivery?: string | null;
  tracking_url?: string | null;
}

// -- Card payloads -----------------------------------------------------------------

export interface ProductsPayload {
  title?: string;
  layout?: "carousel" | "grid" | "list";
  items: { product: AgentProduct; reason?: string | null }[];
}

export interface ComparisonPayload {
  title?: string;
  dimensions?: string[];
  recommended_product_id?: string;
  price_delta?: {
    amount: number;
    low_product_id: string;
    high_product_id: string;
  };
  entries: {
    product_id: string;
    product: AgentProduct;
    pros?: string[];
    cons?: string[];
    best_for?: string;
  }[];
}

export interface PlanPayload {
  title: string;
  intro?: string;
  steps: { label: string; detail?: string | null; products: AgentProduct[] }[];
}

export interface GuidePayload {
  title: string;
  sections: { heading: string; body: string }[];
  related_products?: AgentProduct[];
  sources?: string[];
}

export interface OrderStatusPayload {
  order_id: string;
  summary: string;
  next_step?: string;
  order: AgentOrder;
}

export interface CheckoutPayload {
  note?: string;
  fulfillment_method?: string;
  cart: AgentCart;
  /** Filled by the backend after the model's call; the model never sees the URL. */
  handoffs?: { url: string; label?: string; seller?: string }[];
}

/** Consumed by the transcript as chips on the composer; never reaches the card registry. */
export const CHIPS_COMPONENT = "suggestions";

export interface UIBlock {
  component: string;
  payload: unknown;
}

// -- Transcript --------------------------------------------------------------------

export interface TraceEntry {
  kind: "tool_call" | "tool_result" | "turn_complete" | "error";
  turn: number;
  label: string;
  detail?: string;
  isError?: boolean;
  /** "blocked" when a gate held the call; `reason` names the gate. */
  status?: string;
  reason?: string;
  /** tool_result only: the head of a long result, sent when `detail` is just "ok". */
  excerpt?: string;
  /** performance.now() at arrival. */
  at: number;
  /** turn_complete only. */
  elapsedMs?: number;
}

/** `retrying`: the attempt failed validation; its last frame stays until a retry adopts it. */
export type UISlotStatus = "pending" | "partial" | "retrying" | "final";

export type AssistantSegment =
  | { type: "text"; text: string }
  | { type: "error"; text: string }
  | { type: "ui"; block: UIBlock; slotKey: string; status: UISlotStatus };

export interface UserChatItem {
  kind: "user";
  text: string;
}

export interface AssistantChatItem {
  kind: "assistant";
  turn: number;
  segments: AssistantSegment[];
  suggestions: string[];
  pending: boolean;
  tools: string[];
  /** Status line for the call in flight; cleared when prose or a card lands. */
  activity?: string;
}

export type ChatItem = UserChatItem | AssistantChatItem;

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "1 item", "3 items". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Black · Large" for a variant or a cart line; empty when nothing was chosen. */
export function optionValuesLabel(
  item: Pick<AgentProduct, "option_values">,
): string {
  return Object.values(item.option_values ?? {}).join(" · ");
}

/** What a message to the assistant calls a line: "the Dome Pendant (Black)". */
export function lineName(line: AgentCartLine): string {
  const chosen = Object.values(line.option_values ?? {}).join(" · ");
  return chosen ? `${line.title} (${chosen})` : line.title;
}
