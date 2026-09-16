# Commerceplate

A Shopify commerce project. The storefront is a Next.js 16 (App Router) site
against the Shopify Storefront API (GraphQL), styled with Tailwind CSS v4. It's
paired with a Python shopping agent sidecar (`shopping-agent/`) that Next.js
proxies to, built on the `anthropics/commerce-agents` packages. A future
`merchant-agent/` sibling is scaffolded for but does not exist yet.

## Layout

| Path | What |
|---|---|
| `src/`, `scripts/` | The Next.js storefront (this README) |
| `shopping-agent/` | Python FastAPI shopping assistant sidecar — see [`shopping-agent/README.md`](shopping-agent/README.md) |

## Requirements

- Node >= 22.20 (`.tool-versions` pins 26.5.0)
- npm (the repo uses `package-lock.json`; ignore the `yarn` in `packageManager`)
- A Shopify store with the **Headless** sales channel enabled
- To run the shopping agent too: Python 3 + Docker (see its own README)
- To use the merchant portal (`/merchant`): Docker, for its Postgres database

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Shopify credentials (see `.env.example` for the required variables).

### Shopping agent (optional)

The storefront's assistant modal works only if this sidecar is running and
`ASSISTANT_API_URL` + `ASSISTANT_INTERNAL_TOKEN` are set in the root `.env` too
(same token value in both `.env` files).

```bash
cd shopping-agent
cp .env.example .env     # fill in the variables marked REQUIRED
docker compose up --build
```

Without Docker:

```bash
cd shopping-agent
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
PYTHONPATH=. .venv/bin/uvicorn shopping_assistant.main:app --port 8000 --workers 1 --timeout-keep-alive 75
```

See [`shopping-agent/README.md`](shopping-agent/README.md) for configuration,
tests, and evals.

### Merchant portal (optional)

`/merchant` is an internal portal gated by its own login (separate from
Shopify customer accounts) — not linked from the storefront, direct URL
only. Needs Postgres and at least one seeded account:

```bash
docker compose up -d postgres
npx prisma migrate dev
node scripts/create-merchant-account.mjs owner@example.com yourpassword "Your Name"
```

`DATABASE_URL` in `.env`/`.env.example` already points at the compose
service's default credentials — change it if you're running Postgres
yourself instead. Then visit `/merchant`, which redirects to
`/merchant/login` until you sign in. See `CLAUDE.md`'s "Merchant portal"
section and `SPEC-merchant-login.md` for the full design.

## Commands

```bash
npm run dev             # theme generator (watch) + next dev
npm run build            # theme generator + next build
npm run start             # start production server
npm run lint               # eslint on src/**/*.{js,jsx,ts,tsx}
npm run format               # prettier -w ./src
npm run remove-darkmode        # strip dark-mode support, then format
```

There is no test runner configured for the Next.js app itself (`shopping-agent/`
has its own `pytest`/`ruff` setup — see its README).

## Architecture

See `CLAUDE.md` for the full architecture notes: theme generation, the Shopify
data layer, auth/cart cookie handling, the merchant portal and its own login,
content pages, import aliases, lint/format conventions, and the commerce-agent
decision record (identity binding, the internal API the agent calls back into,
sessions, evals).
