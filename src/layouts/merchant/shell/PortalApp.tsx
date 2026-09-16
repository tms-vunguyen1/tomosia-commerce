"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import PortalShell, { type PortalNavItem } from "@/layouts/merchant/shell/PortalShell";
import AssistantPanel from "@/layouts/merchant/rail/AssistantPanel";
import AssistantRail from "@/layouts/merchant/rail/AssistantRail";
import type { Prefill } from "@/layouts/merchant/rail/Composer";
import Inspector from "@/layouts/merchant/inspector/Inspector";
import CatalogView from "@/layouts/merchant/views/CatalogView";
import HomeView from "@/layouts/merchant/views/HomeView";
import InventoryView from "@/layouts/merchant/views/InventoryView";
import OrdersView from "@/layouts/merchant/views/OrdersView";
import { ALERTS } from "@/layouts/merchant/lib/fixtures/alerts";
import { LISTINGS } from "@/layouts/merchant/lib/fixtures/listings";
import { OVERVIEW } from "@/layouts/merchant/lib/fixtures/overview";
import { RECENT_ORDERS } from "@/layouts/merchant/lib/fixtures/orders";
import { PRICING } from "@/layouts/merchant/lib/fixtures/pricing";
import { TRACE } from "@/layouts/merchant/lib/fixtures/trace";
import { TRANSCRIPT } from "@/layouts/merchant/lib/fixtures/transcript";

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

export default function PortalApp({
  operator,
}: {
  operator: { name: string; role: string };
}) {
  const router = useRouter();
  const [view, setView] = useState<PortalView>("home");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

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

  // No live agent (per the spec, the rail is a static transcript) — opens
  // the rail and prefills the composer with what would have been sent, so
  // every "Ask"/"Draft" hand-off across the views is still demonstrably
  // wired end to end.
  const askAssistant = useCallback((text: string) => {
    setAssistantOpen(true);
    setPrefill({ text, nonce: Date.now() });
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/merchant/api/logout", { method: "POST" });
    router.push("/merchant/login");
    router.refresh();
  }, [router]);

  return (
    <>
      <PortalShell
        brand={{ mark: <StoreMark />, name: "Tomosia", detail: "Merchant workspace" }}
        nav={nav}
        view={view}
        onViewChange={setView}
        operator={operator}
        onLogout={handleLogout}
        assistantOpen={assistantOpen}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
        rail={
          <AssistantRail open={assistantOpen}>
            <AssistantPanel
              turns={TRANSCRIPT}
              listings={LISTINGS}
              prefill={prefill}
              onClose={() => setAssistantOpen(false)}
              onPrefill={askAssistant}
              onOpenActivity={() => setActivityOpen(true)}
            />
          </AssistantRail>
        }
      >
        {view === "home" ? <HomeView data={OVERVIEW} operator={operator.name} onAskAssistant={askAssistant} onNavigate={setView} /> : null}
        {view === "catalog" ? (
          <CatalogView listings={LISTINGS} alertsList={ALERTS.inventory} pricing={PRICING} onAskAssistant={askAssistant} />
        ) : null}
        {view === "orders" ? <OrdersView issues={ALERTS.order_issues} recentOrders={RECENT_ORDERS} onAskAssistant={askAssistant} /> : null}
        {view === "inventory" ? <InventoryView data={ALERTS} onAskAssistant={askAssistant} /> : null}
      </PortalShell>
      {activityOpen ? <Inspector groups={TRACE} onClose={() => setActivityOpen(false)} /> : null}
    </>
  );
}
