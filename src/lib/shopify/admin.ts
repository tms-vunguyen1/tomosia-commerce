// The merchant agent's Shopify Admin API access. Separate from index.ts's Storefront API
// client on purpose: Admin API writes need a different credential (a Dev Dashboard app's
// client-credentials grant, not a static Storefront token) and different scopes
// (read/write products, inventory, orders). Never imported by anything storefront-facing.
//
// The Dev Dashboard app has no "reveal token" screen (see ../../../CLAUDE.md's merchant
// agent decision record) — its Admin API access token is fetched via OAuth client
// credentials and expires every 24h, so this module caches one and refreshes it shortly
// before it expires instead of requiring a long-lived secret in .env.

import { ensureStartsWith } from "@/lib/utils";

const ADMIN_API_VERSION = "2025-01";
// Refresh this many seconds before the token's own expiry, so a request in flight never
// races a refresh.
const REFRESH_MARGIN_S = 60;

let cached: { token: string; expiresAt: number } | null = null;

function requireAdminEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set; see .env.example`);
  }
  return value;
}

async function fetchAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const domain = ensureStartsWith(
    requireAdminEnv("SHOPIFY_STORE_DOMAIN"),
    "https://",
  );
  const response = await fetch(`${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireAdminEnv("SHOPIFY_ADMIN_CLIENT_ID"),
      client_secret: requireAdminEnv("SHOPIFY_ADMIN_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Admin API token request failed: ${response.status}`);
  }
  const body = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_MARGIN_S * 1000 > Date.now()) {
    return cached.token;
  }
  cached = await fetchAccessToken();
  return cached.token;
}

export class AdminAPIError extends Error {
  constructor(
    message: string,
    readonly errors?: unknown,
  ) {
    super(message);
    this.name = "AdminAPIError";
  }
}

/**
 * One Admin API GraphQL call. Throws `AdminAPIError` on a transport failure or a
 * GraphQL-level error — callers that need to distinguish "not found" from "failed"
 * check the shape of `data` themselves (Shopify returns 200 with null fields rather
 * than an HTTP 404 for an unknown id).
 */
export async function adminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const domain = ensureStartsWith(
    requireAdminEnv("SHOPIFY_STORE_DOMAIN"),
    "https://",
  );
  const token = await getAccessToken();
  const response = await fetch(
    `${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new AdminAPIError(`Admin API returned ${response.status}`);
  }
  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (body.errors) {
    throw new AdminAPIError("Admin API returned errors", body.errors);
  }
  if (body.data === undefined) {
    throw new AdminAPIError("Admin API returned no data");
  }
  return body.data;
}
