/**
 * Static activity trace for the Inspector — one group per assistant reply
 * in lib/fixtures/transcript.ts, each a plausible paired tool call/result
 * for that reply. Invented (this repo has no merchant-agent backend to
 * trace), but shaped like a real one: one tool per data need, JSON in and
 * out.
 */

export interface TraceEntry {
  tool: string;
  input: string;
  result: string;
}

export interface TraceGroup {
  label: string;
  entries: TraceEntry[];
}

export const TRACE: TraceGroup[] = [
  {
    label: "Reply 1 · Morning digest",
    entries: [
      { tool: "get_inventory_alerts", input: "{}", result: '{"low_stock": 3, "slow_movers": 1}' },
      { tool: "get_order_issues", input: "{}", result: '{"open_issues": 3}' },
    ],
  },
  {
    label: "Reply 2 · This week",
    entries: [
      {
        tool: "get_business_snapshot",
        input: '{"period": "2026-09-08/2026-09-14", "compare_to": "2026-09-01/2026-09-07"}',
        result: '{"sales": 19420.0, "orders": 63, "sales_change_pct": 8.4}',
      },
    ],
  },
  {
    label: "Reply 3 · Restock proposal",
    entries: [
      {
        tool: "get_listing_detail",
        input: '{"listing_id": "gid://shopify/ProductVariant/47643685519522"}',
        result: '{"title": "Cotton Novelty Pendant", "stock": 3, "sales_last_30d": 48}',
      },
      {
        tool: "stage_inventory_change",
        input: '{"listing_id": "gid://shopify/ProductVariant/47643685519522", "field": "stock", "after": 43}',
        result: '{"change_id": "chg-2041", "status": "staged"}',
      },
    ],
  },
];
