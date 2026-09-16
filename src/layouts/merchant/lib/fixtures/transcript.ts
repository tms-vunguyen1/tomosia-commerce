/**
 * The one pre-authored assistant conversation the rail shows (static, per
 * the spec — no live agent). Surfaces all three generative card types,
 * referencing the same fixture listings/changes the views read. User turns
 * reuse three of the reference AssistantPanel's own suggested starters.
 */

import type { Block } from "../../cards/GenerativeBlock";
import { ALERTS } from "./alerts";
import { LISTINGS } from "./listings";
import { OVERVIEW } from "./overview";

const COTTON_NOVELTY_PENDANT = LISTINGS.find((listing) => listing.title === "Cotton Novelty Pendant")!;
const PENDING_RESTOCK = OVERVIEW.needs_attention.pending_changes[0];

export interface TranscriptTurn {
  role: "user" | "assistant";
  text?: string;
  blocks?: Block[];
}

export const TRANSCRIPT: TranscriptTurn[] = [
  { role: "user", text: "What needs my attention this morning?" },
  {
    role: "assistant",
    text: "Here's what's moving and what needs you today.",
    blocks: [
      {
        component: "digest",
        payload: {
          title: "Morning digest",
          items: [
            {
              kind: "low_stock",
              ref_id: COTTON_NOVELTY_PENDANT.listing_id,
              headline: "Cotton Novelty Pendant is down to 3 units — under two days of cover",
              why_it_matters: "It's the fastest mover in Pendant Lights this week.",
              listing: COTTON_NOVELTY_PENDANT,
            },
            {
              kind: "order_issue",
              ref_id: ALERTS.order_issues[0].order_id,
              headline: ALERTS.order_issues[0].summary,
            },
          ],
        },
      },
    ],
  },
  { role: "user", text: "How did sales do this week compared to last?" },
  {
    role: "assistant",
    text: "Sales are up 8.4% against the prior week — a solid week, mostly carried by Pendant Lights.",
    blocks: [
      {
        component: "metrics",
        payload: {
          title: "This week",
          period: OVERVIEW.snapshot.period,
          metrics: [
            {
              metric: "sales",
              value: OVERVIEW.snapshot.sales,
              change_pct: OVERVIEW.snapshot.sales_change_pct,
              currency: "USD",
              series: { metric: "sales", points: OVERVIEW.trends?.sales ?? [] },
            },
            {
              metric: "orders",
              value: OVERVIEW.snapshot.orders,
              change_pct: OVERVIEW.snapshot.orders_change_pct,
              series: { metric: "orders", points: OVERVIEW.trends?.orders ?? [] },
            },
          ],
        },
      },
    ],
  },
  { role: "user", text: "Draft a restock plan for Cotton Novelty Pendant." },
  {
    role: "assistant",
    text: "Here's a restock proposal — review it whenever you're ready.",
    blocks: [
      {
        component: "change_preview",
        payload: {
          change_id: PENDING_RESTOCK.change_id,
          headline: "Refill Cotton Novelty Pendant before it sells out",
          note: "Puts about a month of cover back on the shelf at the trailing sales pace.",
          change: PENDING_RESTOCK,
        },
      },
    ],
  },
];
