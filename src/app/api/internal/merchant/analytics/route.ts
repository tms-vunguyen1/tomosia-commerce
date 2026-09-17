import { refuseUnlessInternal } from "@/lib/merchant-assistant/internal";
import { analyticsSeries, analyticsWindow } from "@/lib/shopify/analytics";
import { NextRequest, NextResponse } from "next/server";

/**
 * Real sales/orders/AOV and traffic/conversion, via ShopifyQL — `merchant_assistant.
 * backend.ShopifyMerchant` no longer simulates any of this (see ../../../../CLAUDE.md's
 * decision record). Two modes:
 *
 *   ?mode=window&since=...&until=...            one period's totals
 *   ?mode=series&metric=...&since=...&until=...&granularity=day|week   a metric over time
 */
export async function GET(request: NextRequest) {
  const refusal = refuseUnlessInternal(request);
  if (refusal) return refusal;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  if (!since || !until) {
    return NextResponse.json({ detail: "since and until are required" }, { status: 400 });
  }

  if (mode === "series") {
    const metric = searchParams.get("metric") || "sales";
    const granularity = searchParams.get("granularity") === "week" ? "week" : "day";
    const points = await analyticsSeries(metric, since, until, granularity);
    return NextResponse.json({ points });
  }

  const window = await analyticsWindow(since, until);
  return NextResponse.json(window);
}
