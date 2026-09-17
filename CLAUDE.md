# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Commerceplate: a Next.js 16 (App Router) storefront powered by the Shopify Storefront API (GraphQL), styled with Tailwind CSS v4. Node >=22.20 required (`.tool-versions` pins 26.5.0).

## Commands

`make help` lists the dev commands (`make setup`, `make dev`, `make dev-shopping-agent`, `make test`, `make lint`, ...) — see `README.md` for the full walkthrough and Shopify credential setup (`.env`). Note: despite `packageManager: yarn` in `package.json`, this repo actually uses **npm** (`package-lock.json` is the real lockfile, no `yarn.lock` present). The Next.js app itself has no test runner; `shopping-agent/` and `merchant-agent/` each have their own `pytest`/`ruff` setup, run together via `make test`/`make lint`.

## Documentation layout

Feature specs and their task logs live under `docs/<feature>/{spec,plan,todo}.md` (`docs/shopping-assistant-ui-mock/` — superseded by the real `shopping-agent/` — `docs/merchant-portal/`, `docs/merchant-login/`). `docs/deployment.md` covers the Vercel + Render production setup (`render.yaml` at the repo root is the Render Blueprint). Each agent's own architecture (identity binding, backend wiring, known limits) lives in its own `ARCHITECTURE.md` (`shopping-agent/ARCHITECTURE.md`, `merchant-agent/ARCHITECTURE.md`), not here — see "Commerce agent decision record" below. This file and `README.md` stay at the repo root by convention.

## Architecture

### Theme generation (build-time step, not a runtime concern)

`src/config/theme.json` (colors, fonts) is compiled by `scripts/themeGenerator.mjs` into `src/styles/generated-theme.css` (a Tailwind v4 `@theme` block). This runs automatically before `dev`/`build` — **never hand-edit `generated-theme.css`**, edit `theme.json` and let the generator regenerate it. Other site-wide config lives in `src/config/config.json` (site metadata, Shopify collection handles used for the hero slider/featured products, pagination, feature toggles), `src/config/menu.json`, and `src/config/social.json`.

### Shopify data layer (`src/lib/shopify/`)

- `index.ts` is the single entry point for all Storefront API calls (`shopifyFetch`) and response reshaping (flattening GraphQL `edges`/`nodes` connections, filtering hidden products, computing collection paths). Deliberately has **no** `"use server"` directive — it exports customer and cart functions that must stay server-only.
- `actions.ts` re-exports only the narrow subset (`getProducts`, `getCollectionProducts`) needed by client components (infinite scroll) as actual server actions (`"use server"`). Never add customer/cart calls here — that would turn them into browser-callable endpoints.
- `queries/`, `mutations/`, `fragments/` hold the raw GraphQL documents; `types.ts` holds the corresponding TS shapes (`Shopify*Operation` request/response pairs plus reshaped domain types like `Product`, `Cart`, `Collection`).
- Auth uses the Private/Public Storefront Access Token system (Headless sales channel), with fallback to the legacy `SHOPIFY_STOREFRONT_ACCESS_TOKEN` for backward compatibility — see the token-selection logic at the top of `index.ts`.
- Webhook-driven ISR: `revalidate()` in `index.ts` is called from an API route on Shopify product/collection webhooks and revalidates the `TAGS.products`/`TAGS.collections` cache tags (defined in `src/lib/constants.ts`).

### Auth & cart cookies

- The customer access token is stored in an **httpOnly** cookie (`AUTH_COOKIE` / `AUTH_COOKIE_OPTIONS` in `src/lib/constants.ts`) — never expose it to client JS. `src/app/api/customer/*/route.ts` (login/logout/sign-up/me) are the only places that read/write it; client code calls these routes and only ever receives the customer profile, never the token.
- `src/lib/utils/cartActions.ts` (`"use server"`) owns cart mutations (`addItem`/`removeItem`/`updateItemQuantity`) and cart-cookie (`cartId`) lifecycle, including `attachCustomerToCart` which merges a guest cart into the customer's identity on login. Logout deletes both the auth cookie and `cartId` so the next visitor doesn't inherit the previous customer's cart.

### Merchant portal (`src/app/(merchant)/`, `src/layouts/merchant/`)

An internal, fixture-data UI at `/merchant` (own root layout, own palette — `src/styles/merchant.css` — no storefront Header/Footer/cart). Per `docs/merchant-portal/spec.md`: no link from the storefront anywhere, direct-URL access only, still true after login was added. Gated by its own auth (below), independent of the customer auth system and of the Python `shopping-agent`. See `docs/merchant-portal/spec.md` and `docs/merchant-login/spec.md` for the full design. A real merchant agent backend now exists (`merchant-agent/`, "Merchant agent" in the Commerce agent decision record below) — the portal UI itself is still wired to its fixture data pending that React slice.

**Merchant login** — a separate identity system from Shopify customers/staff (Shopify has no API to verify a staff member's password; see `docs/merchant-login/spec.md`'s interview notes). Postgres via Prisma (`prisma/schema.prisma`: `MerchantUser`, `MerchantSession`), started with the root `docker-compose.yml` (`docker compose up -d postgres`, own compose project — not `shopping-agent/docker-compose.yml`, which is pinned to a different project name for an unrelated service). `src/lib/merchant/auth.ts` is the single source of truth for hashing (bcrypt, cost 12) and session create/read/delete; `src/lib/merchant/db.ts` is the Prisma client singleton. Accounts are created only via `node scripts/create-merchant-account.mjs <email> <password> <name>` — no self-service sign-up.

- Two-tier gate: `src/middleware.ts` (Edge runtime, matcher `/merchant/:path*`) only checks that `MERCHANT_AUTH_COOKIE` is present — it never touches Prisma. The real, DB-backed check is `src/app/(merchant)/merchant/(dashboard)/layout.tsx`, a server component that calls `getSessionUser` and redirects to `/merchant/login` on any missing/invalid/expired session.
- Login/logout routes live at `/merchant/api/{login,logout}` (`src/app/(merchant)/merchant/api/**`), **not** `src/app/api/merchant/**` — `MERCHANT_AUTH_COOKIE_OPTIONS.path` is `/merchant`, and a route under `/api/merchant/**` falls outside that path prefix so the browser never sends the cookie there (this broke logout once; see the "Task 4.1" entry in `docs/merchant-login/todo.md` for the full story). Both routes are in `middleware.ts`'s `PUBLIC_PATHS` so they're reachable without a valid session.
- `MERCHANT_AUTH_COOKIE` (`merchant_session`, `path: "/merchant"`) is separate in name and path from the customer's `AUTH_COOKIE` (`path: "/"`) — structurally kept off storefront/agent requests. The reverse isn't wire-level true (the customer cookie's `path: "/"` means browsers attach it everywhere, `/merchant/*` included) — what actually holds is that neither system's code ever reads the other's cookie name.
- Session TTL 8h, one role (no permissions tiers), no rate-limiting/forgot-password/self-service sign-up — all explicitly deferred, see `docs/merchant-login/spec.md` Boundaries.
- `scripts/test-merchant-auth.mjs` is the required self-check (hash/verify round-trip, session-expiry rejection) — run with `node scripts/test-merchant-auth.mjs`. It mirrors `auth.ts`'s operations rather than importing the module: Node can't resolve this repo's extensionless, path-aliased TS imports without a loader (no ts-node/tsx installed).

### Content (non-Shopify pages)

Static/markdown-driven pages (About, Contact, Terms, Privacy, homepage sections) live in `src/content/**/*.md` with YAML frontmatter, parsed via `gray-matter` in `src/lib/contentParser.ts`:
- `getListPage(filePath)` — a single `_index.md` file (e.g. section/page intros).
- `getSinglePage(folder)` — all non-`_index` `.md` files in a folder, filtered by `draft` and future `date`.
`src/app/[regular]/page.tsx` is a catch-all route that statically generates any page under `src/content/pages/` by slug. `src/lib/taxonomyParser.ts` builds taxonomy lists (tags/categories) off of `getSinglePage`.

### Import aliases (`tsconfig.json`)

`@/components/*` → `src/layouts/components`, `@/shortcodes/*` → `src/layouts/shortcodes`, `@/partials/*` → `src/layouts/partials`, `@/helpers/*` → `src/layouts/helpers`, `@/*` → `src/*`. Use these instead of relative paths crossing these directories.

### Layout structure

- `src/layouts/components/` — reusable UI (cart, product, filters, range slider, loading states).
- `src/layouts/partials/` — page-section-level composites (Header, Footer, ProductCardView/ListView, ProductFilters, FeaturedProducts, SeoMeta).
- `src/layouts/shortcodes/` — MDX shortcodes (Accordion, Tab, Button, Video, Youtube, Notice) registered in `all.tsx` and rendered by `src/layouts/helpers/MDXContent.tsx`.
- `src/layouts/helpers/` — small standalone helpers (`ImageFallback`, `DynamicIcon`).

## Conventions

- ESLint enforces `react-hooks/exhaustive-deps` as an **error** (not a warning) — hook dependency arrays must be correct, not suppressed.
- Prettier with `prettier-plugin-tailwindcss` runs over `./src` — don't hand-order Tailwind classes.

## Commerce agent decision record

Both the shopping and merchant assistants are **Python sidecars**
(`shopping-agent/`, `merchant-agent/`), each built on the
`anthropics/commerce-agents` packages at ref
`fd4d59224ab96b43c6dc6888207c67b3bd5a24cf` (local clone read from
`../commerce-agents`). Next.js owns the UI and proxies to both; each imports
the packages rather than porting them, so prompt, tools, gates, grounding,
fencing and the executor all come from upstream.

- **Shopping agent** (serves customers): full architecture in
  `shopping-agent/ARCHITECTURE.md`; eval suite (15 cases) in
  `shopping-agent/evals/README.md`.
- **Merchant agent** (serves the store's own staff — pricing, inventory,
  campaigns; no customer-facing surface, independent of the shopping agent):
  full architecture in `merchant-agent/ARCHITECTURE.md`.

`/add-commerce-flow` and `/author-commerce-evals` read those files — update
the relevant one when a decision changes.
