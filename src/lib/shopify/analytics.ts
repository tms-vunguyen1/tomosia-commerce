// Real store analytics for the merchant agent, via ShopifyQL (`shopifyqlQuery`) —
// the only Admin API surface that has sales/orders/AOV *and* traffic/conversion
// (sessions live nowhere in the plain Admin GraphQL schema; ShopifyQL's `sessions`
// schema is the one place they're queryable). Needs the `read_reports` scope on top
// of everything else this app already has.

import { adminGraphQL } from "./admin";

export interface ShopifyQLResult {
  columns: { name: string; dataType: string }[];
  rows: Record<string, string>[];
}

export async function shopifyQL(query: string): Promise<ShopifyQLResult> {
  const data = await adminGraphQL<{
    shopifyqlQuery: { tableData: ShopifyQLResult | null; parseErrors: string[] };
  }>(`query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name dataType } rows } parseErrors } }`, {
    q: query,
  });
  if (data.shopifyqlQuery.parseErrors.length) {
    throw new Error(`ShopifyQL error: ${data.shopifyqlQuery.parseErrors.join("; ")}`);
  }
  return data.shopifyqlQuery.tableData ?? { columns: [], rows: [] };
}

function num(row: Record<string, string> | undefined, key: string): number {
  const value = row?.[key];
  return value === undefined ? 0 : Number(value);
}

/** Sales/orders/AOV and traffic/conversion for one window — two ShopifyQL queries
 * (the `sales` and `sessions` schemas don't share a FROM). */
export async function analyticsWindow(
  since: string,
  until: string,
): Promise<{
  sales: number;
  orders: number;
  average_order_value: number;
  traffic: number;
  conversion_rate: number;
}> {
  const [salesResult, sessionsResult] = await Promise.all([
    shopifyQL(`FROM sales SHOW total_sales, orders, average_order_value SINCE ${since} UNTIL ${until}`),
    shopifyQL(`FROM sessions SHOW sessions, conversion_rate SINCE ${since} UNTIL ${until}`),
  ]);
  const salesRow = salesResult.rows[0];
  const sessionsRow = sessionsResult.rows[0];
  return {
    sales: num(salesRow, "total_sales"),
    orders: num(salesRow, "orders"),
    average_order_value: num(salesRow, "average_order_value"),
    traffic: num(sessionsRow, "sessions"),
    conversion_rate: num(sessionsRow, "conversion_rate"),
  };
}

const SALES_METRICS = new Set(["sales", "revenue", "orders", "average_order_value", "aov"]);
const METRIC_FIELD: Record<string, string> = {
  sales: "total_sales",
  revenue: "total_sales",
  orders: "orders",
  average_order_value: "average_order_value",
  aov: "average_order_value",
  traffic: "sessions",
  conversion: "conversion_rate",
  conversion_rate: "conversion_rate",
};

/** One metric's daily or weekly series over a window. */
export async function analyticsSeries(
  metric: string,
  since: string,
  until: string,
  granularity: "day" | "week",
): Promise<{ date: string; value: number }[]> {
  const cleaned = metric.trim().toLowerCase().replace(/\s+/g, "_");
  const field = METRIC_FIELD[cleaned] ?? "total_sales";
  const schema = SALES_METRICS.has(cleaned) || !(cleaned in METRIC_FIELD) ? "sales" : "sessions";
  const result = await shopifyQL(
    `FROM ${schema} SHOW ${field} TIMESERIES ${granularity} SINCE ${since} UNTIL ${until} ORDER BY ${granularity} ASC`,
  );
  return result.rows.map((row) => ({ date: String(row[granularity]), value: num(row, field) }));
}
