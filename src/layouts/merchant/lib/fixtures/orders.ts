/** Hand-authored recent orders — Shopify's Storefront API exposes no order
 * history without a signed-in customer, so this is invented, not pulled. */

import type { RecentOrder } from "../types";

export const RECENT_ORDERS: RecentOrder[] = [
  { order_id: "TOM-1051", status: "processing", placed_at: "2026-09-14", total: 29.99, items: 1 },
  { order_id: "TOM-1049", status: "shipped", placed_at: "2026-09-14", total: 4200.0, items: 1 },
  { order_id: "TOM-1046", status: "delivered", placed_at: "2026-09-13", total: 1560.0, items: 2 },
  { order_id: "TOM-1042", status: "delayed", placed_at: "2026-09-12", total: 4200.0, items: 1 },
  { order_id: "TOM-1038", status: "return_initiated", placed_at: "2026-09-11", total: 69.99, items: 1 },
  { order_id: "TOM-1035", status: "delivered", placed_at: "2026-09-10", total: 780.0, items: 1 },
];
