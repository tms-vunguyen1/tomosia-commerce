/**
 * Hand-authored pricing context for the plain (non-family) listings, keyed
 * by listing_id. Family listings skip the pricing section in the detail
 * sheet (per the reference), so there's no entry needed for the two
 * families in listings.ts.
 */

import type { PricingContext } from "../types";

export const PRICING: Record<string, PricingContext> = {
  "gid://shopify/ProductVariant/47643685159074": {
    // Bedside Lamp
    listing_id: "gid://shopify/ProductVariant/47643685159074",
    current_price: 69.99,
    currency: "USD",
    unit_cost: 32,
    margin_pct: 54.3,
    min_price: 55,
    max_price: 89,
    min_price_basis: "cost",
    demand_signal: "steady",
    last_changed: "2026-08-20",
  },
  "gid://shopify/ProductVariant/47643685191842": {
    // Copper Light
    listing_id: "gid://shopify/ProductVariant/47643685191842",
    current_price: 59.99,
    currency: "USD",
    unit_cost: 24,
    margin_pct: 60.0,
    min_price: 45,
    max_price: 75,
    min_price_basis: "cost",
    demand_signal: "rising",
    last_changed: "2026-07-15",
  },
  "gid://shopify/ProductVariant/47643685519522": {
    // Cotton Novelty Pendant
    listing_id: "gid://shopify/ProductVariant/47643685519522",
    current_price: 29.99,
    currency: "USD",
    unit_cost: 12,
    margin_pct: 60.0,
    min_price: 24,
    max_price: 38,
    min_price_basis: "cost",
    demand_signal: "rising",
    last_changed: "2026-06-01",
  },
  "gid://shopify/ProductVariant/47643684798626": {
    // Light Drum Pendant — matches the applied price change in overview.ts
    listing_id: "gid://shopify/ProductVariant/47643684798626",
    current_price: 2567.0,
    currency: "USD",
    unit_cost: 1450,
    margin_pct: 43.5,
    min_price: 1900,
    max_price: 2900,
    min_price_basis: "policy",
    demand_signal: "falling",
    last_changed: "2026-09-10",
  },
  "gid://shopify/ProductVariant/47643684831394": {
    // Silk Drum Lamp Shade
    listing_id: "gid://shopify/ProductVariant/47643684831394",
    current_price: 3200.0,
    currency: "USD",
    unit_cost: 1800,
    margin_pct: 43.75,
    min_price: 2600,
    max_price: 3600,
    min_price_basis: "cost",
    demand_signal: "steady",
    last_changed: "2026-04-22",
  },
};
