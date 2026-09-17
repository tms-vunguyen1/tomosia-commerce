"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PortalShell, { type PortalNavItem } from "@/layouts/merchant/shell/PortalShell";
import AssistantPanel from "@/layouts/merchant/rail/AssistantPanel";
import AssistantRail from "@/layouts/merchant/rail/AssistantRail";
import type { Prefill } from "@/layouts/merchant/rail/Composer";
import Inspector from "@/layouts/merchant/inspector/Inspector";
import CatalogView from "@/layouts/merchant/views/CatalogView";
import HomeView from "@/layouts/merchant/views/HomeView";
import InventoryView from "@/layouts/merchant/views/InventoryView";
import OrdersView from "@/layouts/merchant/views/OrdersView";
import { TRACE } from "@/layouts/merchant/lib/fixtures/trace";
import { MerchantApi } from "@/layouts/merchant/lib/api";
import { useMerchantChat } from "@/layouts/merchant/lib/useMerchantChat";
import type {
  AlertsResponse,
  ListingDetails,
  OverviewResponse,
  PricingContext,
} from "@/layouts/merchant/lib/types";

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
  overview,
  listings,
  pricing,
  alerts: alertsData,
}: {
  operator: { name: string; role: string };
  overview: OverviewResponse;
  listings: ListingDetails[];
  pricing: Record<string, PricingContext>;
  alerts: AlertsResponse;
}) {
  const router = useRouter();
  const [view, setView] = useState<PortalView>("home");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const api = useMemo(() => new MerchantApi(), []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chat = useMerchantChat(api, sessionId);

  // The session starts the first time the rail is opened, not on page load — same
  // reasoning as the shopping assistant's modal (src/layouts/components/assistant).
  useEffect(() => {
    if (!assistantOpen || sessionId) return;
    let cancelled = false;
    void api.start().then((result) => {
      if (cancelled) return;
      if (!("error" in result)) setSessionId(result.sessionId);
    });
    return () => {
      cancelled = true;
    };
  }, [assistantOpen, sessionId, api]);

  const alertCounts = overview.snapshot.alerts;
  const nav = useMemo<PortalNavItem<PortalView>[]>(
    () => [
      { id: "home", label: "Home", icon: "FaHouse" },
      { id: "catalog", label: "Catalog", icon: "FaTag" },
      { id: "orders", label: "Orders", icon: "FaInbox", attention: alertCounts?.order_issues ?? null },
      {
        id: "inventory",
        label: "Inventory",
        icon: "FaBox",
        count: (alertCounts?.low_stock ?? 0) + (alertCounts?.slow_movers ?? 0),
      },
    ],
    [alertCounts],
  );

  // Opens the rail and prefills the composer rather than sending straight away —
  // every "Ask"/"Draft" hand-off across the views lands as a draft the operator can
  // still edit before it goes to the (now live) assistant.
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
              turns={chat.turns}
              listings={listings}
              prefill={prefill}
              busy={chat.busy}
              onClose={() => setAssistantOpen(false)}
              onPrefill={askAssistant}
              onOpenActivity={() => setActivityOpen(true)}
              onSend={chat.send}
              onApprove={chat.onApprove}
              onDismiss={chat.onDismiss}
            />
          </AssistantRail>
        }
      >
        {view === "home" ? <HomeView data={overview} operator={operator.name} onAskAssistant={askAssistant} onNavigate={setView} /> : null}
        {view === "catalog" ? (
          <CatalogView listings={listings} alertsList={alertsData.inventory} pricing={pricing} onAskAssistant={askAssistant} />
        ) : null}
        {view === "orders" ? (
          <OrdersView issues={alertsData.order_issues} recentOrders={overview.recent_orders} onAskAssistant={askAssistant} />
        ) : null}
        {view === "inventory" ? <InventoryView data={alertsData} onAskAssistant={askAssistant} /> : null}
      </PortalShell>
      {activityOpen ? <Inspector groups={TRACE} onClose={() => setActivityOpen(false)} /> : null}
    </>
  );
}
