# Commerceplate

A Shopify commerce project. The storefront is a Next.js 16 (App Router) site
against the Shopify Storefront API (GraphQL), styled with Tailwind CSS v4. It's
paired with two Python sidecars that Next.js proxies to, both built on the
`anthropics/commerce-agents` packages: a shopping agent (`shopping-agent/`) for
customers, and a merchant agent (`merchant-agent/`) for the store's own staff.

## Layout

| Path | What |
|---|---|
| `src/`, `scripts/` | The Next.js storefront (this README) |
| `shopping-agent/` | Python FastAPI shopping assistant sidecar — see [`shopping-agent/README.md`](shopping-agent/README.md) |
| `merchant-agent/` | Python FastAPI merchant assistant sidecar — see [`merchant-agent/README.md`](merchant-agent/README.md) |
| `docs/` | Specs and task logs for past features, grouped by feature; see `docs/deployment.md` for the Vercel + Render setup |

## Requirements

- Node >= 22.20 (`.tool-versions` pins 26.5.0)
- npm (the repo uses `package-lock.json`; ignore the `yarn` in `packageManager`)
- A Shopify store with the **Headless** sales channel enabled (shopping agent) and a
  Dev Dashboard app with Admin API access (merchant agent — see its README)
- To run either agent: Python 3 + Docker (see each one's own README)
- To use the merchant portal (`/merchant`): Docker, for its Postgres database

## Setup

Quick start (installs deps, starts Postgres, migrates, creates both agents'
venvs):

```bash
make setup
```

Then fill in `.env`, `shopping-agent/.env` and `merchant-agent/.env` (Shopify +
Anthropic credentials — see each `.env.example`) and run `make dev`. `make help`
lists every target (`dev-shopping-agent`, `dev-merchant-agent`, `test`, `lint`,
`seed-merchant`, ...).

Equivalent by hand, without `make`:

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Shopify credentials (see `.env.example` for the required variables).

### Shopping agent (optional)

The storefront's assistant modal works only if this sidecar is running and
`ASSISTANT_API_URL` + `ASSISTANT_INTERNAL_TOKEN` are set in the root `.env`
too (same token value in both `.env` files): `make dev-shopping-agent`. See
[`shopping-agent/README.md`](shopping-agent/README.md) for configuration,
running without Docker, tests, and evals.

### Merchant agent (optional)

The merchant portal's assistant rail works only if this sidecar is running
and `MERCHANT_ASSISTANT_API_URL` + `MERCHANT_ASSISTANT_INTERNAL_TOKEN` are set
in the root `.env` too, plus `SHOPIFY_ADMIN_CLIENT_ID`/`SHOPIFY_ADMIN_CLIENT_SECRET`
for its Shopify Admin API access: `make dev-merchant-agent`. See
[`merchant-agent/README.md`](merchant-agent/README.md) for the Admin API
credential setup, running without Docker, tests, and known limits.

### Merchant portal (optional)

`/merchant` is an internal portal gated by its own login (separate from
Shopify customer accounts) — not linked from the storefront, direct URL
only. `make setup` already starts Postgres and migrates; seed the first
account with `make seed-merchant EMAIL=owner@example.com PASSWORD=yourpassword NAME="Your Name"`,
then visit `/merchant`, which redirects to `/merchant/login` until you sign
in. `DATABASE_URL` in `.env`/`.env.example` already points at the compose
service's default credentials — change it if you're running Postgres
yourself instead. See `CLAUDE.md`'s "Merchant portal" section and
`docs/merchant-login/spec.md` for the full design.

## Commands

```bash
npm run dev             # theme generator (watch) + next dev
npm run build            # theme generator + next build
npm run start             # start production server
npm run lint               # eslint on src/**/*.{js,jsx,ts,tsx}
npm run format               # prettier -w ./src
npm run remove-darkmode        # strip dark-mode support, then format
```

There is no test runner configured for the Next.js app itself (`shopping-agent/` and
`merchant-agent/` each have their own `pytest`/`ruff` setup — see their READMEs).
`make test` and `make lint` run both agents' suites alongside `npm run lint`.

## Deployment

The Next.js app deploys to Vercel; the two agents, their Redis, and the
merchant-login Postgres deploy to Render via `render.yaml`. See
`docs/deployment.md` for the full walkthrough.

## Architecture

See `CLAUDE.md` for the full architecture notes: theme generation, the Shopify
data layer, auth/cart cookie handling, the merchant portal and its own login,
content pages, import aliases, lint/format conventions, and the commerce-agent
decision record (identity binding, the internal API the agent calls back into,
sessions, evals).
