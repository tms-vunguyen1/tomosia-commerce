/**
 * Formatting helpers ported from commerce-agents/examples/web-shared/format.ts
 * (only the subset the merchant portal's views need — more are added
 * task-by-task as a view first needs them, per the plan's vertical slicing).
 * `orderRows` is retail-vertical-specific, ported from the reference's own
 * merchant-web/lib/format.ts.
 */

import { ORDER_STATUS } from "./kinds";
import type { RecentOrder } from "./types";
import type { RecordRowData } from "../ui/RecordList";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: number,
  currency = "USD",
  options: { whole?: boolean } = {},
): string {
  const key = `${currency}:${options.whole ? 0 : 2}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: options.whole ? 0 : 2,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

const plain = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return plain.format(value);
}

/** Rates arrive as percent values (3.4 means 3.4%). */
export function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatChangePct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Date-only strings parse as local midnight so they do not render a day early. */
function parseDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

const ISO_DAY = /\d{4}-\d{2}-\d{2}/g;

function dayLabel(value: string): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Jun 24, 2026"; dates inside a trailing note ("(revised from ...)") are formatted too. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}(?!T)/.test(value)) return value.replace(ISO_DAY, dayLabel);
  return dayLabel(value);
}

/** "Jun 24" */
export function formatDayMonth(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "1 order", "3 orders". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/** "12 days of cover", "1 day of cover", "<1 day of cover". */
export function coverLabel(days: number): string {
  return days < 1 ? "<1 day of cover" : `${plural(Math.round(days), "day")} of cover`;
}

export function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** What can still be chosen on a product with options, and what a variant chose. */
export interface OptionFields {
  price: number;
  currency?: string;
  options?: Record<string, string[]>;
  option_values?: Record<string, string>;
}

/** True for a family record: the cart takes one of its variants, chosen with the assistant. */
export function hasOptions(product: Pick<OptionFields, "options">): boolean {
  return Object.keys(product.options ?? {}).length > 0;
}

/** "twin · full · queen · king", one group per option separated by " / "; empty for a plain product. */
export function optionSummary(product: Pick<OptionFields, "options">): string {
  return Object.values(product.options ?? {})
    .map((values) => values.join(" · "))
    .join(" / ");
}

/** "king · slate" for a variant; empty when nothing was chosen. */
export function optionValuesLabel(item: Pick<OptionFields, "option_values">): string {
  return Object.values(item.option_values ?? {}).join(" · ");
}

/** "From $349" on a family record, whose price is its lowest variant's; the plain price otherwise. */
export function priceLabel(product: OptionFields): string {
  const money = formatMoney(product.price, product.currency);
  return hasOptions(product) ? `From ${money}` : money;
}

const ISO_RANGE = /^(\d{4}-\d{2}-\d{2})\s*\/\s*(\d{4}-\d{2}-\d{2})$/;

/** "2026-06-19/2026-06-25" as "Jun 19–25". */
export function formatPeriodLabel(value: string | null | undefined): string {
  if (!value) return "";
  const match = ISO_RANGE.exec(value.trim());
  if (!match) return value;
  const start = parseDate(match[1]);
  const end = parseDate(match[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return value;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDate(match[1])} – ${formatDate(match[2])}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${formatDayMonth(match[1])} – ${formatDayMonth(match[2])}`;
  }
  return `${formatDayMonth(match[1])}–${end.getDate()}`;
}

/** "prior week"/"prior period" when the windows abut at equal length; else the window's label. */
export function formatComparisonLabel(period: string | null | undefined, compareTo: string | null | undefined): string {
  if (!compareTo) return "";
  const primary = ISO_RANGE.exec(period?.trim() ?? "");
  const compare = ISO_RANGE.exec(compareTo.trim());
  if (primary && compare) {
    const dayMs = 24 * 60 * 60 * 1000;
    const primaryStart = parseDate(primary[1]).getTime();
    const primaryDays = Math.round((parseDate(primary[2]).getTime() - primaryStart) / dayMs);
    const compareEnd = parseDate(compare[2]).getTime();
    const compareDays = Math.round((compareEnd - parseDate(compare[1]).getTime()) / dayMs);
    if (primaryDays === compareDays && Math.round((primaryStart - compareEnd) / dayMs) === 1) {
      return primaryDays === 6 ? "prior week" : "prior period";
    }
  }
  return formatPeriodLabel(compareTo);
}

/** "Good morning" before noon, "Good afternoon" until six, then "Good evening". */
export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function orderRows(orders: RecentOrder[]): RecordRowData[] {
  return orders.map((order) => ({
    id: order.order_id,
    detail: plural(order.items, "item"),
    sub: `${formatDayMonth(order.placed_at)} · ${formatMoney(order.total)}`,
    status: ORDER_STATUS[order.status] ?? { label: order.status.replaceAll("_", " "), tone: "muted" as const },
  }));
}

export function describeProposer(change: { created_by: string; created_by_kind?: "operator" | "agent" }): string {
  return change.created_by_kind === "agent" ? `Proposed by ${change.created_by}'s assistant` : `Staged by ${change.created_by}`;
}

/** Approvals are always a person. */
export function describeResolver(change: {
  status: string;
  applied_by?: string | null;
  discarded_by?: string | null;
  discarded_by_kind?: "operator" | "agent" | null;
}): string | null {
  if (change.status === "applied" && change.applied_by) return `Approved by ${change.applied_by}`;
  if (change.status === "discarded" && change.discarded_by) {
    return change.discarded_by_kind === "agent" ? `Dismissed by ${change.discarded_by}'s assistant` : `Dismissed by ${change.discarded_by}`;
  }
  return null;
}
