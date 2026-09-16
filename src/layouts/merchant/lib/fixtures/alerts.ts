/** Hand-authored, consistent with lib/fixtures/listings.ts's real ids. */

import type { AlertsResponse } from "../types";

export const ALERTS: AlertsResponse = {
  inventory: [
    {
      listing_id: "gid://shopify/ProductVariant/47643685519522",
      title: "Cotton Novelty Pendant",
      kind: "low_stock",
      stock: 3,
      threshold: 8,
      days_of_cover: 1.9,
      sales_last_30d: 48,
      storefront_visible: true,
    },
    {
      listing_id: "gid://shopify/ProductVariant/47643684765858",
      title: "Single Pendant",
      kind: "low_stock",
      option_values: { Size: "Short" },
      variant_of: "gid://shopify/Product/9330220466338",
      stock: 0,
      threshold: 5,
      sales_last_30d: 8,
      storefront_visible: false,
    },
    {
      listing_id: "gid://shopify/ProductVariant/47643685650594",
      title: "Novelty Pendant",
      kind: "low_stock",
      option_values: { Color: "DCDBD7", Size: "Long Wire" },
      variant_of: "gid://shopify/Product/9330220728482",
      stock: 2,
      threshold: 5,
      days_of_cover: 4,
      sales_last_30d: 5,
      storefront_visible: true,
    },
    {
      listing_id: "gid://shopify/ProductVariant/47643684798626",
      title: "Light Drum Pendant",
      kind: "slow_mover",
      stock: 14,
      sales_last_30d: 1,
    },
  ],
  order_issues: [
    {
      issue_id: "iss-1001",
      order_id: "TOM-1042",
      kind: "delayed",
      summary: "Shipment delayed 3 days past the promised delivery window",
      listing_id: "gid://shopify/ProductVariant/47643684700322",
      opened_at: "2026-09-12",
    },
    {
      issue_id: "iss-1002",
      order_id: "TOM-1038",
      kind: "return_spike",
      summary: "4 returns this week citing a cracked ceramic base",
      listing_id: "gid://shopify/ProductVariant/47643685159074",
      opened_at: "2026-09-11",
    },
    {
      issue_id: "iss-1003",
      order_id: "TOM-1051",
      kind: "buyer_message",
      summary: "Buyer asking when the pendant restocks",
      listing_id: "gid://shopify/ProductVariant/47643685519522",
      buyer_message_excerpt: "Hi, do you know when the cotton pendant will be restocked? I need 3 for a nursery project.",
      opened_at: "2026-09-14",
    },
  ],
};
