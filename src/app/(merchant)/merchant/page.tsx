"use client";

import { useCallback, useMemo, useState } from "react";
import PortalShell, { type PortalNavItem } from "@/layouts/merchant/shell/PortalShell";
import CatalogView from "@/layouts/merchant/views/CatalogView";
import HomeView from "@/layouts/merchant/views/HomeView";
import InventoryView from "@/layouts/merchant/views/InventoryView";
import OrdersView from "@/layouts/merchant/views/OrdersView";
import { ALERTS } from "@/layouts/merchant/lib/fixtures/alerts";
import { LISTINGS } from "@/layouts/merchant/lib/fixtures/listings";
import { OVERVIEW } from "@/layouts/merchant/lib/fixtures/overview";
import { RECENT_ORDERS } from "@/layouts/merchant/lib/fixtures/orders";

type PortalView = "home" | "catalog" | "orders" | "inventory";

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
  // Tracked but not rendered until Task 10 builds the listing detail sheet.
  const [_openListing, setOpenListing] = useState<string | null>(null);

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
          <aside className="hidden w-80 shrink-0 border-l border-(--line) bg-(--card) p-4 text-[13px] text-(--ink-soft) lg:block">
            <p>Assistant rail — built in a later task.</p>
            {prefill ? <p className="mt-2 rounded-lg bg-(--well) p-2 text-(--ink)">&ldquo;{prefill}&rdquo;</p> : null}
          </aside>
        ) : null
      }
    >
      {view === "home" ? <HomeView data={OVERVIEW} operator="Jordan" onAskAssistant={askAssistant} onNavigate={setView} /> : null}
      {view === "catalog" ? (
        <CatalogView listings={LISTINGS} alertsList={ALERTS.inventory} onAskAssistant={askAssistant} onOpenListing={setOpenListing} />
      ) : null}
      {view === "orders" ? <OrdersView issues={ALERTS.order_issues} recentOrders={RECENT_ORDERS} onAskAssistant={askAssistant} /> : null}
      {view === "inventory" ? <InventoryView data={ALERTS} onAskAssistant={askAssistant} /> : null}
    </PortalShell>
  );
}
