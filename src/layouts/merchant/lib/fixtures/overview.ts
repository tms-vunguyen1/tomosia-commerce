/** Hand-authored business snapshot, trends, and insights — derives its
 * counts from alerts.ts/orders.ts so the Home view stays internally
 * consistent with the Inventory/Orders views' own fixture data. */

import type { OverviewResponse, StagedChange } from "../types";
import { ALERTS } from "./alerts";
import { RECENT_ORDERS } from "./orders";

const PENDING_CHANGE: StagedChange = {
  change_id: "chg-2041",
  kind: "inventory_action",
  status: "staged",
  summary: "Add 40 units of Cotton Novelty Pendant",
  items: [{ target: "gid://shopify/ProductVariant/47643685519522", field: "stock", before: 3, after: 43 }],
  created_at: "2026-09-15",
  created_by: "Avery",
  created_by_kind: "agent",
  currency: "USD",
};

const APPLIED_CHANGE: StagedChange = {
  change_id: "chg-2036",
  kind: "price_update",
  status: "applied",
  summary: "Lower Light Drum Pendant from $2,899 to $2,567",
  items: [{ target: "gid://shopify/ProductVariant/47643684798626", field: "price", before: 2899.0, after: 2567.0 }],
  created_at: "2026-09-10",
  created_by: "Jordan",
  created_by_kind: "operator",
  applied_at: "2026-09-10",
  applied_by: "Jordan",
  currency: "USD",
  margin_before_pct: 41.2,
  margin_after_pct: 33.8,
};

export const OVERVIEW: OverviewResponse = {
  snapshot: {
    period: "2026-09-08/2026-09-14",
    compare_to: "2026-09-01/2026-09-07",
    sales: 19420.0,
    orders: 63,
    traffic: 2140,
    conversion_rate: 2.9,
    average_order_value: 308.25,
    sales_change_pct: 8.4,
    orders_change_pct: 5.0,
    traffic_change_pct: -1.2,
    conversion_change_pct: 0.3,
    currency: "USD",
    alerts: {
      low_stock: ALERTS.inventory.filter((a) => a.kind === "low_stock").length,
      slow_movers: ALERTS.inventory.filter((a) => a.kind === "slow_mover").length,
      order_issues: ALERTS.order_issues.length,
      pending_changes: 1,
    },
  },
  needs_attention: {
    inventory: ALERTS.inventory,
    order_issues: ALERTS.order_issues,
    pending_changes: [PENDING_CHANGE],
  },
  recent_orders: RECENT_ORDERS,
  recent_changes: [PENDING_CHANGE, APPLIED_CHANGE],
  trends: {
    sales: [
      { date: "2026-09-08", value: 2400 },
      { date: "2026-09-09", value: 2650 },
      { date: "2026-09-10", value: 2300 },
      { date: "2026-09-11", value: 2800 },
      { date: "2026-09-12", value: 3100 },
      { date: "2026-09-13", value: 2950 },
      { date: "2026-09-14", value: 3220 },
    ],
    orders: [
      { date: "2026-09-08", value: 7 },
      { date: "2026-09-09", value: 9 },
      { date: "2026-09-10", value: 8 },
      { date: "2026-09-11", value: 10 },
      { date: "2026-09-12", value: 11 },
      { date: "2026-09-13", value: 9 },
      { date: "2026-09-14", value: 9 },
    ],
    conversion: [
      { date: "2026-09-08", value: 2.6 },
      { date: "2026-09-09", value: 2.8 },
      { date: "2026-09-10", value: 2.7 },
      { date: "2026-09-11", value: 3.0 },
      { date: "2026-09-12", value: 3.1 },
      { date: "2026-09-13", value: 2.9 },
      { date: "2026-09-14", value: 3.2 },
    ],
    average_order_value: [
      { date: "2026-09-08", value: 295 },
      { date: "2026-09-09", value: 301 },
      { date: "2026-09-10", value: 288 },
      { date: "2026-09-11", value: 305 },
      { date: "2026-09-12", value: 312 },
      { date: "2026-09-13", value: 318 },
      { date: "2026-09-14", value: 322 },
    ],
  },
  trends_prior: {
    sales: [
      { date: "2026-09-01", value: 2200 },
      { date: "2026-09-02", value: 2350 },
      { date: "2026-09-03", value: 2400 },
      { date: "2026-09-04", value: 2600 },
      { date: "2026-09-05", value: 2900 },
      { date: "2026-09-06", value: 2750 },
      { date: "2026-09-07", value: 2720 },
    ],
    orders: [
      { date: "2026-09-01", value: 7 },
      { date: "2026-09-02", value: 8 },
      { date: "2026-09-03", value: 8 },
      { date: "2026-09-04", value: 9 },
      { date: "2026-09-05", value: 10 },
      { date: "2026-09-06", value: 9 },
      { date: "2026-09-07", value: 9 },
    ],
    conversion: [
      { date: "2026-09-01", value: 2.5 },
      { date: "2026-09-02", value: 2.6 },
      { date: "2026-09-03", value: 2.6 },
      { date: "2026-09-04", value: 2.7 },
      { date: "2026-09-05", value: 2.8 },
      { date: "2026-09-06", value: 2.7 },
      { date: "2026-09-07", value: 2.6 },
    ],
    average_order_value: [
      { date: "2026-09-01", value: 285 },
      { date: "2026-09-02", value: 290 },
      { date: "2026-09-03", value: 292 },
      { date: "2026-09-04", value: 296 },
      { date: "2026-09-05", value: 300 },
      { date: "2026-09-06", value: 298 },
      { date: "2026-09-07", value: 302 },
    ],
  },
  insights: [
    {
      insight_id: "ins-1",
      kind: "restock",
      headline: "Cotton Novelty Pendant sells ~48 a month on 3 units of cover — under two days left",
      detail: "It's the fastest mover in Pendant Lights this week; a restock keeps it from going dark.",
      prompt: "Draft a restock plan for Cotton Novelty Pendant (gid://shopify/ProductVariant/47643685519522).",
    },
    {
      insight_id: "ins-2",
      kind: "content",
      headline: "Novelty Pendant's color options show as raw codes (\"697978\", \"DCDBD7\") to shoppers",
      detail: "Relabeling them (e.g. Graphite, Ivory) would likely help conversion on the listing.",
      prompt: "Draft human-readable color names for Novelty Pendant's two finishes.",
    },
  ],
};
