"use client";

import DynamicIcon from "@/helpers/DynamicIcon";
import type { ReactNode } from "react";

export interface PortalNavItem<V extends string> {
  id: V;
  label: string;
  /** A react-icons/fa6 component name, e.g. "FaHouse". */
  icon: string;
  /** A plain count shown beside the label. */
  count?: number | null;
  /** A count that needs the operator; tinted. */
  attention?: number | null;
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-full bg-(--well) text-[12px] font-semibold text-(--ink) shadow-[inset_0_0_0_1px_var(--line)]"
    >
      {initials}
    </span>
  );
}

interface PortalBrand {
  mark: ReactNode;
  name: string;
  detail: string;
}

/**
 * The merchant portal's frame: a nav rail (views + the assistant toggle +
 * the signed-in operator), the page, and the assistant rail beside it.
 * Ported from commerce-agents/examples/web-shared/portal/Shell.tsx —
 * desktop-first per the spec, so the reference's `lg:hidden` mobile top bar
 * isn't ported; the rail stays visible (icon-only below `xl`) at any width
 * instead of swapping to a second layout.
 */
export default function PortalShell<V extends string>({
  brand,
  nav,
  view,
  onViewChange,
  operator,
  onLogout,
  assistantOpen,
  assistantBusy = false,
  onToggleAssistant,
  rail,
  children,
}: {
  brand: PortalBrand;
  nav: PortalNavItem<V>[];
  view: V;
  onViewChange: (view: V) => void;
  operator: { name: string; role: string };
  onLogout: () => void;
  assistantOpen: boolean;
  assistantBusy?: boolean;
  onToggleAssistant: () => void;
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh bg-(--ground) text-(--ink)">
      <aside className="flex w-16 shrink-0 flex-col border-r border-(--line) bg-(--chrome) px-2 py-3.5 xl:w-55 xl:px-3">
        <div className="flex items-center gap-2.5 px-1 pb-4 xl:px-2">
          {brand.mark}
          <div className="hidden min-w-0 xl:block">
            <div className="truncate text-[14px] font-semibold leading-tight">{brand.name}</div>
            <div className="truncate text-[12px] text-(--ink-soft)">{brand.detail}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Portal views">
          {nav.map((item) => {
            const active = item.id === view;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={`relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[14px] transition-colors ${
                  active ? "bg-(--well) font-semibold text-(--ink)" : "font-medium text-(--ink-2) hover:bg-(--ground)"
                }`}
              >
                <DynamicIcon
                  icon={item.icon}
                  className={`text-[17px] ${active ? "text-(--ink)" : "text-(--ink-soft)"}`}
                />
                <span className="hidden min-w-0 flex-1 truncate xl:block">{item.label}</span>
                {item.attention ? (
                  <span className="absolute right-1 top-1 rounded-full bg-(--danger-soft) px-1.5 text-[11px] font-semibold text-(--danger) xl:static">
                    {item.attention}
                  </span>
                ) : item.count != null ? (
                  <span className="hidden text-[12px] tabular-nums text-(--ink-soft) xl:inline">{item.count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={onToggleAssistant}
          aria-pressed={assistantOpen}
          aria-label={assistantOpen ? "Hide assistant" : "Show assistant"}
          title={assistantOpen ? "Hide assistant" : "Show assistant"}
          className={`mt-3 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14px] font-semibold transition-colors ${
            assistantOpen ? "bg-(--accent-soft) text-(--accent-ink)" : "text-(--ink-2) hover:bg-(--ground)"
          }`}
        >
          <DynamicIcon icon="FaWandMagicSparkles" className="text-[16px] text-(--accent)" />
          <span className="hidden flex-1 xl:block">Assistant</span>
          {assistantBusy ? (
            <span className="relative hidden h-2 w-2 xl:flex" aria-label="Working">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--accent) opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-(--accent)" />
            </span>
          ) : assistantOpen ? (
            <span
              aria-hidden
              className="hidden h-1.75 w-1.75 rounded-full bg-(--accent) shadow-[0_0_0_3px_var(--accent-soft)] xl:block"
            />
          ) : null}
        </button>
        <div className="mt-auto flex items-center gap-2.5 border-t border-(--line) px-1 pt-3 xl:px-2">
          <Avatar name={operator.name} />
          <div className="hidden min-w-0 flex-1 xl:block">
            <div className="truncate text-[13px] font-semibold leading-tight">{operator.name}</div>
            <div className="truncate text-[11.5px] text-(--ink-soft)">{operator.role}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="shrink-0 rounded-md p-1.5 text-(--ink-soft) transition-colors hover:bg-(--ground) hover:text-(--ink)"
          >
            <DynamicIcon icon="FaArrowRightFromBracket" className="text-[15px]" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6">{children}</div>
          </main>
          {rail}
        </div>
      </div>
    </div>
  );
}
