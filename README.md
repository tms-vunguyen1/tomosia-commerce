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
data layer, auth/cart cookie handling, content pages, import aliases, lint/format
conventions, and the commerce-agent decision record (identity binding, the
internal API the agent calls back into, sessions, evals).
