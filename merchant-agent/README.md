# Merchant assistant

The merchant portal's assistant, built on the
[`anthropics/commerce-agents`](https://github.com/anthropics/commerce-agents) packages.
It serves the store's own staff over a `MerchantBackend`; the prompt, tool contracts,
gates, grounding, fencing and turn loop are imported from those packages and are not
reimplemented here. See `ARCHITECTURE.md` for the full decision record.

## How the pieces sit

```
browser  ──►  Next.js /merchant/api/*         (session id only; login cookie read server-side)
                   │
                   ▼
              agent service  (this directory)
                   │  MerchantBackend
                   ▼
              Next.js /api/internal/merchant/*   (every Shopify Admin API call lives here)
                   │
                   ▼
              Shopify Admin API + ShopifyQL  (everything except campaigns)  +  a local
              fixture  (campaigns — Shopify has no ad-campaign object at all)
```

The browser never reaches this service, and this service holds no Shopify credential:
every Admin API call goes back through the app, which owns the client-credentials token
(`src/lib/shopify/admin.ts`, `src/lib/shopify/analytics.ts`) and the mapping onto the
agent's record shapes (`src/lib/merchant-assistant/shapes.ts`).

## Running it

```bash
cp .env.example .env     # fill in the variables marked REQUIRED
docker compose up --build
```

Then start the storefront (`npm run dev` at the repo root) with
`MERCHANT_ASSISTANT_API_URL` and the same `MERCHANT_ASSISTANT_INTERNAL_TOKEN` in its own
`.env`, plus `SHOPIFY_ADMIN_CLIENT_ID`/`SHOPIFY_ADMIN_CLIENT_SECRET` for the Admin API
(see "Admin API credential" below). The merchant portal's dashboard
(`/merchant`) and its assistant rail both need this service running — there is no
fixture fallback if it isn't.

Without Docker:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
PYTHONPATH=. .venv/bin/uvicorn merchant_assistant.main:app --port 8100 --workers 1 --timeout-keep-alive 75
```

Memory is off (`enable_memory=False` in `merchant_assistant/config.py`), same reasoning
as the shopping agent.

## Admin API credential

This app is a Shopify **Dev Dashboard** app, which has no "reveal token" screen — there
is no static Admin API access token to copy. Instead:

1. Create the app at [dev.shopify.com](https://dev.shopify.com), in the same
   organization as this store.
2. **Set its distribution to "Custom"** (Overview → Distribution → Select distribution
   method → Custom distribution → enter the store domain → Generate link). This step is
   easy to skip since nothing else demands it up front, but it's what gates the Order
   object, ShopifyQL, and Protected Customer Data generally — left unset (or Public), the
   Admin API refuses with `"This app is not approved to access the Order object"` no
   matter what order scopes are granted, and **distribution can't be changed after the
   fact**, so get this right before installing.
3. Configure Admin API scopes: `read_products`, `write_products`, `read_inventory`,
   `write_inventory`, `read_locations`, `read_orders`, `write_orders`, `read_reports`
   (the last one for traffic/conversion via ShopifyQL).
4. Open the Custom-distribution install link from step 2 against the store to install
   (or re-authorize, if scopes changed after a first install — a scope added to the app
   config alone does not reach an already-issued token).
5. Copy the app's **Client ID** and **Secret** from its API credentials page into the
   root `.env` as `SHOPIFY_ADMIN_CLIENT_ID`/`SHOPIFY_ADMIN_CLIENT_SECRET` —
   `src/lib/shopify/admin.ts` exchanges them for an access token via OAuth client
   credentials and refreshes it itself (the token expires every ~24h).

Changing scopes later via the Shopify CLI (`shopify app config link
--client-id=... --file-name=shopify.app.toml`, edit `access_scopes.scopes`, `shopify app
deploy --allow-updates`) has to run from inside `tomosia-commerce/` — the CLI needs the
repo's pinned Node version (`.tool-versions`), and a stray global Node on `PATH` fails
with an unrelated `enableCompileCache` syntax error rather than a clear version message.

## Tests and lint

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check .
```

The suite serves the internal admin API from canned records over an httpx transport
(`tests/conftest.py::FakeAdminAPI`), so it covers the client, the backend's rules, the
service, the full stage → approve → live-write path, the live analytics window, and
delayed-order derivation. The mapping from Shopify's Admin API/ShopifyQL shapes lives on
the Next.js side, which has no test runner — verify it against the real store by calling
the internal routes directly, or run the backend against a live `npm run dev` (see
`ARCHITECTURE.md`'s "Verified live" note).

## Known limits

- **Campaigns are simulated demo data.** Shopify has no ad-campaign object at all, live
  or otherwise — the one system here that Protected Customer Data never touched, so there
  was never a live version to switch to. `get_merchant_context`'s `limitations` says so on
  every request.
- **Applying a promotion does not reach Shopify yet.** Staging one previews correctly
  (real current prices, real math); approving it raises `ChangeNotApplicable` rather than
  silently doing nothing. TODO: `discountAutomaticBasicCreate` or a price-list override.
- **`get_order_issues` only reports `"delayed"`** (unfulfilled past
  `MERCHANT_DELAYED_ORDER_DAYS`). `return_spike`/`buyer_message`/`damaged` have no Shopify
  object reachable with this app's scopes (Returns API, Shopify Inbox).
- **Content edits are narrow**: only `title`, `long_description` (→ `descriptionHtml`),
  and `category` (→ `productType`) are editable — Shopify has no general custom-attribute
  store the way the reference's fixture catalog does.
- **Pause/activate is product-level.** Shopify has no per-variant "active" flag; naming
  one variant of a multi-variant family pauses the whole listing.
- **No per-listing sales pace**: `slow_mover` inventory alerts, `sales_last_30d`, and
  `return_rate_pct` are always absent — none has a live source at this app's scopes.
- **Order history is Shopify's 60-day default** (`read_orders`); a store with real history
  past that would need `read_all_orders` too.
