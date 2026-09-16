"use client";

import { useMemo, useState } from "react";
import DynamicIcon from "@/helpers/DynamicIcon";
import { coverLabel, formatChangePct, formatComparisonLabel, formatDayMonth, formatMoney, formatNumber, formatPeriodLabel, formatRate, greeting, orderRows, plural } from "../lib/format";
import { INVENTORY_KINDS, ISSUE_KINDS } from "../lib/kinds";
import type { HomeInsight, InventoryAlert, MetricPoint, OrderIssue, OverviewResponse } from "../lib/types";
import ApprovalsBanner from "../ui/ApprovalsBanner";
import AttentionList from "../ui/AttentionList";
import AttentionRow from "../ui/AttentionRow";
import KindIcon from "../ui/KindIcon";
import PageHeader from "../ui/PageHeader";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import QueueOverflow from "../ui/QueueOverflow";
import RecentChanges from "../ui/RecentChanges";
import RecordList from "../ui/RecordList";
import Segmented from "../ui/Segmented";
import StatStrip from "../ui/StatStrip";
import StatTile from "../ui/StatTile";
import ViewLink from "../ui/ViewLink";

type Filter = "all" | "orders" | "stock" | "slow";
type Row = { kind: "issue"; issue: OrderIssue } | { kind: "inventory"; alert: InventoryAlert };

const ROW_CAP = 6;

/** The question a KPI tile prefills: why the figure moved against the comparison window. */
function askWhy(label: string, changePct: number | null | undefined, comparison: string): string {
  const name = label.toLowerCase();
  if (changePct == null) return `How is ${name} trending, and what's behind it?`;
  return `Why is ${name} ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(1)}% against the ${comparison || "prior period"}?`;
}

/** A ratio's change from its parts' changes, e.g. average order value from sales and orders. */
function ratioChangePct(numeratorPct: number | null | undefined, denominatorPct: number | null | undefined): number | null {
  if (numeratorPct == null || denominatorPct == null) return null;
  return ((1 + numeratorPct / 100) / (1 + denominatorPct / 100) - 1) * 100;
}

/** One sentence from the overview: the sales move and what needs the operator. */
function briefing(data: OverviewResponse): string {
  const { snapshot, needs_attention } = data;
  const parts: string[] = [];
  if (snapshot.sales_change_pct != null) {
    const direction = snapshot.sales_change_pct >= 0 ? "up" : "down";
    parts.push(`Sales are ${direction} ${formatChangePct(Math.abs(snapshot.sales_change_pct)).replace("+", "")} on the week.`);
  }
  const orders = needs_attention.order_issues.length;
  const listings = needs_attention.inventory.length;
  const needs = [orders ? plural(orders, "order") : "", listings ? plural(listings, "listing") : ""].filter(Boolean);
  parts.push(needs.length ? `${needs.join(" and ")} need you today.` : "Nothing needs you today.");
  return parts.join(" ");
}

function values(points?: MetricPoint[]): number[] | undefined {
  return points?.map((point) => point.value);
}

function rows(data: OverviewResponse, filter: Filter): Row[] {
  const { inventory, order_issues } = data.needs_attention;
  const issues = order_issues.map((issue) => ({ kind: "issue" as const, issue }));
  const lowStock = inventory
    .filter((alert) => alert.kind === "low_stock")
    .sort((a, b) => (a.days_of_cover ?? Infinity) - (b.days_of_cover ?? Infinity))
    .map((alert) => ({ kind: "inventory" as const, alert }));
  const slow = inventory.filter((alert) => alert.kind === "slow_mover").map((alert) => ({ kind: "inventory" as const, alert }));
  if (filter === "orders") return issues;
  if (filter === "stock") return lowStock;
  if (filter === "slow") return slow;
  // The most urgent stock alert leads; it is the one a seller acts on first.
  return [...lowStock.slice(0, 1), ...issues, ...lowStock.slice(1), ...slow];
}

function IssueRow({ issue, onAskAssistant }: { issue: OrderIssue; onAskAssistant: (text: string) => void }) {
  const style = ISSUE_KINDS[issue.kind];
  return (
    <AttentionRow
      icon={style.icon}
      tone={style.tone}
      title={issue.summary}
      meta={[style.label, `Order ${issue.order_id}`, issue.opened_at ? `opened ${formatDayMonth(issue.opened_at)}` : ""].filter(Boolean).join(" · ")}
      action={{
        label: issue.kind === "buyer_message" ? "Draft reply" : "Ask",
        onClick: () => onAskAssistant(`What are my options for order ${issue.order_id}? ${issue.summary}.`),
      }}
    />
  );
}

function optionValuesLabel(item: { option_values?: Record<string, string> }): string {
  return Object.values(item.option_values ?? {}).join(" · ");
}

function InventoryRow({ alert, onAskAssistant }: { alert: InventoryAlert; onAskAssistant: (text: string) => void }) {
  const style = INVENTORY_KINDS[alert.kind];
  const soldOut = alert.kind === "low_stock" && alert.stock === 0;
  const low = alert.kind === "low_stock";
  const chosen = optionValuesLabel(alert);
  const name = chosen ? `${alert.title} · ${chosen}` : alert.title;
  const ref = `${name} (${alert.listing_id})`;
  return (
    <AttentionRow
      icon={style.icon}
      tone={soldOut ? "danger" : style.tone}
      title={name}
      meta={
        <>
          <span className={soldOut ? "font-semibold text-(--danger)" : low ? "font-semibold text-(--warn)" : ""}>
            {soldOut ? "Sold out" : `${formatNumber(alert.stock)} in stock`}
          </span>
          {[
            "",
            alert.days_of_cover != null && !soldOut ? coverLabel(alert.days_of_cover) : "",
            alert.sales_last_30d != null ? `${formatNumber(alert.sales_last_30d)} sold in 30 days` : "",
            alert.listing_id,
            soldOut && alert.storefront_visible === false ? "hidden from the storefront" : "",
          ]
            .filter((part, index) => index === 0 || part)
            .join(" · ")}
        </>
      }
      note={
        low && alert.stock > 0 && alert.storefront_visible ? (
          <Pill tone="warn" dot>
            Storefront shows &ldquo;Only {formatNumber(alert.stock)} left&rdquo;
          </Pill>
        ) : null
      }
      action={{
        label: low ? "Draft restock" : "Plan markdown",
        onClick: () => onAskAssistant(low ? `Draft a restock plan for ${ref}.` : `Plan a markdown for ${ref}.`),
      }}
    />
  );
}

function Insights({ insights, onAskAssistant }: { insights: HomeInsight[]; onAskAssistant: (text: string) => void }) {
  if (insights.length === 0) return null;
  return (
    <Panel title="From the assistant" icon={<KindIcon icon="FaWandMagicSparkles" tone="accent" size={24} />}>
      <ul className="divide-y divide-(--line)">
        {insights.map((insight) => (
          <li key={insight.insight_id} className="px-[18px] py-2.5">
            <div className="text-[13px] font-medium leading-snug text-(--ink)">{insight.headline}</div>
            {insight.detail ? <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-(--ink-soft)">{insight.detail}</div> : null}
            <button
              type="button"
              onClick={() => onAskAssistant(insight.prompt)}
              className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--accent-ink) hover:underline"
            >
              Ask <DynamicIcon icon="FaArrowRight" className="text-[13px]" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function HomeView({
  data,
  operator,
  onAskAssistant,
  onNavigate,
}: {
  data: OverviewResponse;
  operator?: string;
  /** Prefills the composer; nothing is sent. */
  onAskAssistant: (text: string) => void;
  onNavigate: (view: "orders" | "inventory") => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const pending = useMemo(() => data.needs_attention.pending_changes.filter((change) => change.status === "staged"), [data]);
  const queue = useMemo(() => rows(data, filter), [data, filter]);
  const now = useMemo(() => new Date(), []);
  const title = `${greeting(now)}${operator ? `, ${operator}` : ""}`;
  const today = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const { snapshot } = data;
  const counts = {
    orders: data.needs_attention.order_issues.length,
    stock: data.needs_attention.inventory.filter((alert) => alert.kind === "low_stock").length,
    slow: data.needs_attention.inventory.filter((alert) => alert.kind === "slow_mover").length,
  };
  const comparison = formatComparisonLabel(snapshot.period, snapshot.compare_to);
  // The snapshot carries no average-order delta, so derive it from the sales and orders deltas.
  const aovChangePct = ratioChangePct(snapshot.sales_change_pct, snapshot.orders_change_pct);
  const currency = snapshot.currency ?? "USD";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} subtitle={`${today} · ${briefing(data)}`} />

      <ApprovalsBanner changes={pending} onReview={() => onAskAssistant("Walk me through the changes awaiting my approval and what each one would do.")} />

      <Panel title="This week" subtitle={`${formatPeriodLabel(snapshot.period)}${comparison ? ` · against the ${comparison}` : ""}`} bodyClassName="pb-1">
        <StatStrip>
          <StatTile
            label="Sales"
            value={formatMoney(snapshot.sales, currency, { whole: snapshot.sales >= 1000 })}
            changePct={snapshot.sales_change_pct}
            points={values(data.trends?.sales)}
            prior={values(data.trends_prior?.sales)}
            onClick={() => onAskAssistant(askWhy("Sales", snapshot.sales_change_pct, comparison))}
            ariaLabel="Sales: ask the assistant why"
          />
          <StatTile
            label="Orders"
            value={formatNumber(snapshot.orders)}
            changePct={snapshot.orders_change_pct}
            points={values(data.trends?.orders)}
            prior={values(data.trends_prior?.orders)}
            onClick={() => onAskAssistant(askWhy("Orders", snapshot.orders_change_pct, comparison))}
            ariaLabel="Orders: ask the assistant why"
          />
          <StatTile
            label="Conversion"
            value={snapshot.conversion_rate != null ? formatRate(snapshot.conversion_rate) : "—"}
            changePct={snapshot.conversion_change_pct}
            points={values(data.trends?.conversion)}
            prior={values(data.trends_prior?.conversion)}
            onClick={() => onAskAssistant(askWhy("Conversion", snapshot.conversion_change_pct, comparison))}
            ariaLabel="Conversion: ask the assistant why"
          />
          <StatTile
            label="Average order"
            value={snapshot.average_order_value != null ? formatMoney(snapshot.average_order_value, currency) : "—"}
            changePct={aovChangePct}
            points={values(data.trends?.average_order_value)}
            prior={values(data.trends_prior?.average_order_value)}
            onClick={() => onAskAssistant(askWhy("Average order value", aovChangePct, comparison))}
            ariaLabel="Average order value: ask the assistant why"
          />
        </StatStrip>
      </Panel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title="Needs you today"
          action={
            <Segmented<Filter>
              label="Filter attention items"
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All", count: counts.orders + counts.stock + counts.slow },
                { id: "orders", label: "Orders", count: counts.orders },
                { id: "stock", label: "Low stock", count: counts.stock },
                { id: "slow", label: "Slow", count: counts.slow },
              ]}
            />
          }
        >
          {queue.length === 0 ? (
            <p className="px-[18px] pb-4 pt-1 text-[13.5px] text-(--ink-soft)">Nothing needs you today.</p>
          ) : (
            <>
              <AttentionList>
                {queue.slice(0, ROW_CAP).map((row) =>
                  row.kind === "issue" ? (
                    <IssueRow key={row.issue.issue_id} issue={row.issue} onAskAssistant={onAskAssistant} />
                  ) : (
                    <InventoryRow key={`${row.alert.kind}-${row.alert.listing_id}`} alert={row.alert} onAskAssistant={onAskAssistant} />
                  ),
                )}
              </AttentionList>
              <QueueOverflow
                hidden={queue.length - ROW_CAP}
                link={{
                  label: "See all",
                  // The hidden rows are order issues first, so open Orders when any of them is one.
                  onClick: () => onNavigate(queue.slice(ROW_CAP).some((row) => row.kind === "issue") ? "orders" : "inventory"),
                }}
              />
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Insights insights={data.insights ?? []} onAskAssistant={onAskAssistant} />
          <Panel title="Recent orders" action={<ViewLink label="All orders" onClick={() => onNavigate("orders")} />}>
            {data.recent_orders.length === 0 ? (
              <p className="px-[18px] pb-4 text-[13px] text-(--ink-soft)">No orders yet.</p>
            ) : (
              <RecordList rows={orderRows(data.recent_orders.slice(0, 4))} />
            )}
          </Panel>
          <RecentChanges changes={data.recent_changes} />
        </div>
      </div>
    </div>
  );
}
