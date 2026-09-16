/**
 * Formatting helpers ported from commerce-agents/examples/web-shared/format.ts
 * (only the subset the merchant portal's views need — more are added
 * task-by-task as a view first needs them, per the plan's vertical slicing).
 */

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
