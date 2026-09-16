"use client";

import { useCallback, useMemo, useState } from "react";
import PortalShell, { type PortalNavItem } from "@/layouts/merchant/shell/PortalShell";
import GenerativeBlock, { type Block } from "@/layouts/merchant/cards/GenerativeBlock";
import CatalogView from "@/layouts/merchant/views/CatalogView";
import HomeView from "@/layouts/merchant/views/HomeView";
import InventoryView from "@/layouts/merchant/views/InventoryView";
import OrdersView from "@/layouts/merchant/views/OrdersView";
import { ALERTS } from "@/layouts/merchant/lib/fixtures/alerts";
import { LISTINGS } from "@/layouts/merchant/lib/fixtures/listings";
import { OVERVIEW } from "@/layouts/merchant/lib/fixtures/overview";
import { RECENT_ORDERS } from "@/layouts/merchant/lib/fixtures/orders";
import { PRICING } from "@/layouts/merchant/lib/fixtures/pricing";

type PortalView = "home" | "catalog" | "orders" | "inventory";

// Task 11 smoke check: one hand-written sample payload per card type,
// built from the real fixtures. Removed once Task 12 wires the real
// transcript in its place.
const COTTON_NOVELTY_PENDANT = LISTINGS.find((listing) => listing.title === "Cotton Novelty Pendant")!;
const SAMPLE_BLOCKS: Block[] = [
  {
    component: "metrics",
    payload: {
      title: "This week",
      period: OVERVIEW.snapshot.period,
      metrics: [
        { metric: "sales", value: OVERVIEW.snapshot.sales, change_pct: OVERVIEW.snapshot.sales_change_pct, currency: "USD", series: { metric: "sales", points: OVERVIEW.trends?.sales ?? [] } },
        { metric: "orders", value: OVERVIEW.snapshot.orders, change_pct: OVERVIEW.snapshot.orders_change_pct, series: { metric: "orders", points: OVERVIEW.trends?.orders ?? [] } },
      ],
    },
  },
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
  {
    component: "change_preview",
    payload: {
      change_id: OVERVIEW.needs_attention.pending_changes[0].change_id,
      headline: "Refill Cotton Novelty Pendant before it sells out",
      note: "Puts about a month of cover back on the shelf at the trailing sales pace.",
      change: OVERVIEW.needs_attention.pending_changes[0],
    },
  },
];

function StoreMark() {
  return (
    <span
      aria-hidden
      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-(--ink) text-[16px] font-bold text-(--brand) shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]"
    >
      T
    </span>
  );
}

export default function MerchantPortalPage() {
  const [view, setView] = useState<PortalView>("home");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);

  const alerts = OVERVIEW.snapshot.alerts;
  const nav = useMemo<PortalNavItem<PortalView>[]>(
    () => [
      { id: "home", label: "Home", icon: "FaHouse" },
      { id: "catalog", label: "Catalog", icon: "FaTag" },
      { id: "orders", label: "Orders", icon: "FaInbox", attention: alerts?.order_issues ?? null },
      { id: "inventory", label: "Inventory", icon: "FaBox", count: (alerts?.low_stock ?? 0) + (alerts?.slow_movers ?? 0) },
    ],
    [alerts],
  );

  // No real chat yet (Task 12) — opens the rail and shows what would have
  // been sent, so every "Ask"/"Draft" button in the views is still
  // demonstrably wired end to end.
  const askAssistant = useCallback((text: string) => {
    setAssistantOpen(true);
    setPrefill(text);
  }, []);

  return (
    <PortalShell
      brand={{ mark: <StoreMark />, name: "Tomosia", detail: "Merchant workspace" }}
      nav={nav}
      view={view}
      onViewChange={setView}
      operator={{ name: "Jordan", role: "Store manager" }}
      assistantOpen={assistantOpen}
      onToggleAssistant={() => setAssistantOpen((open) => !open)}
      rail={
        assistantOpen ? (
          <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-(--line) bg-(--ground) p-3 text-[13px] text-(--ink-soft) lg:flex">
            <p className="px-1">Assistant rail — full transcript built in a later task. Card smoke check:</p>
            {SAMPLE_BLOCKS.map((block, index) => (
              <GenerativeBlock key={index} block={block} listings={LISTINGS} onPrefill={setPrefill} />
            ))}
            {prefill ? <p className="rounded-lg bg-(--well) p-2 text-(--ink)">&ldquo;{prefill}&rdquo;</p> : null}
          </aside>
        ) : null
      }
    >
      {view === "home" ? <HomeView data={OVERVIEW} operator="Jordan" onAskAssistant={askAssistant} onNavigate={setView} /> : null}
      {view === "catalog" ? (
        <CatalogView listings={LISTINGS} alertsList={ALERTS.inventory} pricing={PRICING} onAskAssistant={askAssistant} />
      ) : null}
      {view === "orders" ? <OrdersView issues={ALERTS.order_issues} recentOrders={RECENT_ORDERS} onAskAssistant={askAssistant} /> : null}
      {view === "inventory" ? <InventoryView data={ALERTS} onAskAssistant={askAssistant} /> : null}
    </PortalShell>
  );
}
