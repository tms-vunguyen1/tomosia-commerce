# Merchant agent architecture

Built on the `anthropics/commerce-agents` packages — see `../CLAUDE.md`'s
"Commerce agent decision record" and `../shopping-agent/ARCHITECTURE.md` for
the shared pattern both agents follow (Next.js owns the UI and every Shopify
call; the Python side holds no Shopify credential). Serves the store's own
staff (pricing, inventory, campaigns); no customer-facing surface, independent
of the shopping agent.

## Layout

`merchant_assistant/` is the importable module (backend, the Shopify admin
API client, config, sessions, host, routes, a copy of the five upstream
skills, all indexed); `tests/` sits beside it, mirroring
`shopping-agent/`'s structure. No `evals/` yet — `/author-commerce-evals` is
the natural next step once this flow has run for a while.

## Shell and client

Its own FastAPI service (port 8100) on the Messages API runtime
(`MerchantAgent` from `merchant_agent_runtime`), `AsyncAnthropic` against the
Anthropic API. Model/thinking-effort at the package defaults
(`claude-opus-5`, `low`). Compose project pinned to `merchant-agent` (own
Redis), same reasoning as `shopping-agent/docker-compose.yml`'s pin.

## Identity binding

The merchant portal's own login (Postgres via Prisma,
`../docs/merchant-login/spec.md`) is the operator identity — a completely
separate system from the Shopify customers/staff the shopping agent
identity-binds to. `POST /merchant/api/session` (Next.js, under the
`/merchant` cookie path) reads the `merchant_session` cookie, resolves it to
a `MerchantUser` itself (never trusts a request field), and starts the
sidecar session with `{user_id: MerchantUser.id, operator: MerchantUser.name}`.
The browser receives only `session_id`; every later call carries the session
id alone (`/merchant/api/[...path]/route.ts` mirrors the shopping agent's
`[...path]` proxy exactly). No guest concept — the portal's own auth gate
means every caller is already logged in. `merchant_id` is a deployment-wide
constant (`MERCHANT_ID` env var, one store, no multi-tenant scoping) rather
than session state.

## Where the Shopify queries live

In Next.js, not in the agent — same split as the shopping agent.
`merchant_assistant/backend.py` (`ShopifyMerchant`) calls
`src/app/api/internal/merchant/{listings,listing,pricing,inventory,content,analytics,orders}`
over an HTTP client (`admin_client.py`), which validates the JSON into
`merchant_agent.types`. Those routes use `src/lib/shopify/admin.ts`
(product/inventory/order writes and reads) and `src/lib/shopify/analytics.ts`
(ShopifyQL) — a **separate Admin API client** from the storefront one
(`src/lib/shopify/index.ts`): the merchant agent's app in the Shopify Dev
Dashboard has no static "reveal token" screen (a `shpat_...` token), so
`admin.ts` fetches an Admin API access token via OAuth **client credentials
grant** (`POST /admin/oauth/access_token`,
`SHOPIFY_ADMIN_CLIENT_ID`/`SHOPIFY_ADMIN_CLIENT_SECRET`) and caches/refreshes
it — the token expires every ~24h (`expires_in: 86399`), refreshed 60s before
expiry. Never a fallback to a static token; the app and store must be in the
same Dev Dashboard organization or the grant fails with `shop_not_permitted`.

See `README.md`'s "Admin API credential" section for the one-time Dev
Dashboard setup this app needed beyond scopes (Custom distribution, adding
`read_reports` after first install).

## Backend methods

`ShopifyMerchant`, one system per row:

| System | Wiring |
|---|---|
| `search_listings`, `get_listing` | live — Shopify Admin API (GraphQL `products`/`node`), mapped in `src/lib/merchant-assistant/shapes.ts`; `descriptionHtml` is stripped to plain text there (`plainTextFromHtml`) rather than shown as raw markup or piped through `dangerouslySetInnerHTML` |
| `get_pricing_context`, `stage_price_update` → `apply_change` | live — variant price via `productVariantsBulkUpdate` |
| `get_inventory_alerts`, `stage_inventory_action` → `apply_change` | live — restock via `inventoryAdjustQuantities` (a quantity delta at the store's one location); pause/activate via `productUpdate(status:)` (mutation argument is `product`, not `input` — confirmed by introspection after guessing wrong once), always resolved up to the parent product id since Shopify has no per-variant status |
| `stage_listing_update` → `apply_change` | live, but **narrow**: only `title`/`long_description`/`category` (→ Shopify `title`/`descriptionHtml`/`productType`) are editable; any other field, or a variant target (Shopify has no per-variant title/description/type — a plain listing's id is a variant id, resolved up via `resolveProductId`), is refused with `ChangeNotApplicable` naming why |
| `get_business_snapshot`, `query_metrics` | **live** — sales/orders/average-order-value from the `sales` ShopifyQL schema, traffic/conversion from the `sessions` schema (`src/lib/shopify/analytics.ts`), both needing `read_reports`. Two independent `SINCE/UNTIL` queries per snapshot (current window, prior window) rather than ShopifyQL's own `COMPARE TO` — its generated column names embed the comparison window's own age (e.g. `percent_change_total_sales__sub_14d`), which would have to be computed to parse; plain `change_pct` arithmetic on two totals is simpler and was picked over that |
| `get_order_issues` | **live, narrow**: derived only as `"delayed"` (unfulfilled longer than `MERCHANT_DELAYED_ORDER_DAYS`) from `orders(query: "fulfillment_status:unfulfilled")`. `return_spike`/`buyer_message`/`damaged` are never reported — Shopify has no object for them reachable here (Returns API, Shopify Inbox) |
| `get_campaign_performance`, `stage_campaign` → `apply_change` | **fixture-backed** (`data/merchant_campaigns.json`) — Shopify has no native ad-campaign object and no ad platform is connected; `apply_change` on a campaign just updates the in-memory fixture, nothing external. The one system here PCD never touched — there was never a live version to switch to |
| `stage_promotion` → `apply_change` | stages and previews correctly (live pricing math), but **applying one does not push a live Shopify discount yet** — `_write_to_platform` raises `ChangeNotApplicable` naming the gap. TODO: wire `discountAutomaticBasicCreate` (or a price-list override) |

Every write in the table above performs the live Shopify mutation **before**
flipping the change to `applied` in the ledger (`backend.py::apply_change`),
so a failed Admin API call leaves the change staged, per `MerchantBackend`'s
contract — this is the opposite order from the reference
`MockRetailMerchant`, which can get away with ledger-then-write since its
"write" is dict mutation that cannot fail.

## Sessions

`RedisSessionStore` (own Redis, `docker-compose.yml`, prefix `merchant`),
TTL 24h, one worker — same pattern as the shopping agent's `sessions.py`,
copied and re-keyed. The change ledger (`backend.ShopifyMerchant.ledger`) is
process-wide, not per-session — one store, one shared queue of staged
changes regardless of which operator is looking.

## Approval

`require_host_approval=True`; wired live end to end. The portal's
Approve/Dismiss buttons (`src/layouts/merchant/ui/ApproveBar.tsx`) call the
live `onApprove`/`onDismiss` callbacks the chat hook provides
(`src/layouts/merchant/lib/{api,useMerchantChat}.ts`) → `POST /merchant/api/
changes/{id}/apply|discard` → the `[...path]` proxy → the sidecar's own
`/api/changes/{id}/apply|discard` (`main.py::_change_action`, ported from the
reference's `change_action()`): marks `approved_change_ids`/
`host_action_change_ids` before running the same `MerchantToolExecutor` the
model's own tools use, discards the mark after, whatever the outcome.
Verified live in a browser: approve wrote a real inventory delta to Shopify
(checked and reverted); dismiss left the store untouched.

## The assistant rail is a live chat

Not the static pre-scripted transcript the portal shipped with.
`src/layouts/merchant/lib/{protocol,api,useMerchantChat}.ts` mirror the
shopping assistant's `src/layouts/components/assistant/*` at a simpler
grain: no per-segment interleaving, no partial-frame pacing (`ui_partial` is
skipped; a card appears on its final `ui` frame) — a deliberate scope cut
from the shopping assistant's fuller streaming UI, not an oversight. The
session starts the first time the rail opens (`PortalApp.tsx`), same
lazy-start reasoning as the shopping assistant's modal.

## The portal dashboard reads live data too

Not just the chat rail — a second, larger piece of "remove the mock data"
than the chat wiring alone. `src/app/(merchant)/merchant/(dashboard)/page.tsx`
(a server component) fetches three new session-free, internal-token-gated
agent routes (`GET /api/overview`, `/api/portal/listings`,
`/api/portal/alerts` — not scoped to one operator's session, since there is
one shared store and ledger) and passes the results into `PortalApp` as
props; the four view components (`src/layouts/merchant/views/*.tsx`) needed
**no changes at all**, since their prop types already matched `lib/types.ts`
exactly. The six now-unused fixture files (`overview.ts`, `listings.ts`,
`alerts.ts`, `orders.ts`, `pricing.ts`, `transcript.ts`) are deleted;
`trace.ts` (the Inspector's activity log) is the one fixture left — wiring it
live would mean capturing `tool_call`/`tool_result` events the chat hook
currently ignores, out of scope for this pass. The dashboard's "From the
assistant" insights (`OverviewResponse.insights`) are always empty now — the
reference's version is itself computed/inferred from fixture data, and no
equivalent inference step exists yet; `HomeView` already renders nothing when
the list is empty, so this is a quiet gap, not a bug. `all_listings_with_pricing`
(backend.py) is a vertical extra beyond `MerchantBackend`'s own interface,
exactly like the reference's `DemoStorefront.recent_orders` — one full-catalog
read for the Catalog view, reusing the same `unit_cost` each row already
carries instead of one `get_pricing_context` round trip per listing.

## v1 index

All five skills copied and indexed — `catalog-listings`,
`inventory-operations`, `marketing-campaigns`, `performance-insights`,
`pricing-promotions` — since every system answers something (live or
fixture), none is unwired enough to park in `skills/_staged/`.

## Gates

Fencing, provenance, guardrail, and approval gates are the package's,
unmodified. `MerchantAgentConfig` defaults hold except `brand_name`,
`assistant_name`, `enable_memory=False` (matching the shopping agent), and
`approval_surface` (named as "the Approve button on the change preview
card").

## Memory

Off, same reasoning and mechanism as the shopping agent.

## Known limitations

See `README.md`'s "Known limits" for the full list (campaigns are simulated,
promotions don't push to Shopify yet, `get_order_issues` only reports
"delayed", content edits are narrow, several fields have no live source at
this app's scopes, low-stock threshold is one flat number, order history is
capped at Shopify's 60-day default window).

## Verified live

2026-09-17, against `tomosia.myshopify.com`, after Custom distribution +
`read_reports` were sorted out: search, listing detail
(plain/family/variant), price update, inventory restock, pause/activate, and
content edit each round-tripped through the real Admin API and back (applied,
then reverted); real orders, sales/traffic/conversion (ShopifyQL), and
delayed-order derivation all read correctly against the store's actual order
history. In a real browser: login → live chat turns grounded in real
inventory/order data → a staged restock approved through the UI, checked
against Shopify, and reverted → a staged pause dismissed and confirmed
untouched → all four portal dashboard views (Home/Catalog/Orders/Inventory)
rendering the same live data server-side, no fixtures left in the loop except
campaigns. The pytest suite (9 cases, `FakeClient`-driven) covers session
start, the chat turn, search provenance, the full stage → approve → live-write
path against a fake admin transport, the live analytics window, and
delayed-order derivation.
