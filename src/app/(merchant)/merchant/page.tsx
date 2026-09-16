"use client";

import { useMemo, useState } from "react";
import PortalShell, { type PortalNavItem } from "@/layouts/merchant/shell/PortalShell";
import { OVERVIEW } from "@/layouts/merchant/lib/fixtures/overview";

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

// Task 5: shell + nav wiring only — each view is a placeholder until
// Tasks 6-10 build the real Home/Catalog/Orders/Inventory views.
function ViewPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-(--radius) border border-dashed border-(--line-strong) p-6 text-[13.5px] text-(--ink-soft)">
      {label} view — built in a later task.
    </div>
  );
}

export default function MerchantPortalPage() {
  const [view, setView] = useState<PortalView>("home");
  const [assistantOpen, setAssistantOpen] = useState(false);

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
            Assistant rail — built in a later task.
          </aside>
        ) : null
      }
    >
      {view === "home" ? <ViewPlaceholder label="Home" /> : null}
      {view === "catalog" ? <ViewPlaceholder label="Catalog" /> : null}
      {view === "orders" ? <ViewPlaceholder label="Orders" /> : null}
      {view === "inventory" ? <ViewPlaceholder label="Inventory" /> : null}
    </PortalShell>
  );
}
