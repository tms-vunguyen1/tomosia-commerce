# Commerceplate

Commerceplate is a Shopify storefront built with Next.js 16 and Tailwind CSS
v4. It also ships two optional AI assistants: a **shopping agent** that helps
customers on the storefront, and a **merchant agent** that powers an internal
admin portal (`/merchant`) for store staff. Both assistants are separate
Python services that the Next.js app talks to — you don't need them running
just to work on the storefront itself.

## Project structure

| Path | What it is |
|---|---|
| `src/`, `scripts/` | The Next.js storefront |
| `shopping-agent/` | Customer-facing assistant (Python/FastAPI) — [README](shopping-agent/README.md) |
| `merchant-agent/` | Staff-facing assistant (Python/FastAPI) — [README](merchant-agent/README.md) |
| `docs/` | Design docs, past feature specs, and the [deployment guide](docs/deployment.md) |

## Prerequisites

- Node.js >= 22.20 (see `.tool-versions`)
- npm (this repo uses `package-lock.json`, not the `yarn` in `packageManager`)
- A Shopify store with the **Headless** sales channel enabled
- Docker (only needed if you run the agents or the merchant portal locally)

## Getting started

1. **Install and configure**

   ```bash
   make setup
   ```

   This installs npm packages, starts a local Postgres, runs database
   migrations, and sets up a Python virtual environment for each agent.

2. **Add your credentials**

   Fill in `.env` (Shopify + database) — see `.env.example` for what's
   needed. If you're also running an agent, fill in its `.env` too
   (`shopping-agent/.env.example`, `merchant-agent/.env.example`).

3. **Start the storefront**

   ```bash
   make dev
   ```

   Open <http://localhost:3000>.

Don't have `make`? See [Setup without Make](#setup-without-make) below.

### Optional: run the shopping agent

Powers the storefront's chat assistant. Without it, the storefront still
works, the assistant modal just won't respond.

```bash
make dev-shopping-agent
```

See [`shopping-agent/README.md`](shopping-agent/README.md) for configuration,
running it without Docker, tests, and evals.

### Optional: run the merchant agent + portal

Powers `/merchant`, an internal dashboard and chat assistant for store staff
(pricing, inventory, campaigns). It's not linked from the storefront —
visiting `/merchant` directly redirects to a login screen.

```bash
make dev-merchant-agent
make seed-merchant EMAIL=owner@example.com PASSWORD=yourpassword NAME="Your Name"
```

Then sign in at `/merchant`. See [`merchant-agent/README.md`](merchant-agent/README.md)
for its Shopify Admin API credential setup, and `CLAUDE.md`'s "Merchant
portal" section for how the login system works.

## Everyday commands

| Command | What it does |
|---|---|
| `make dev` | Run the storefront |
| `make test` | Run both agents' test suites |
| `make lint` | Lint the storefront and both agents |
| `make help` | List every available command |

The storefront itself has no automated tests; `shopping-agent/` and
`merchant-agent/` each have their own `pytest` suite, run together via
`make test`.

## Deployment

The storefront deploys to Vercel. The two agents, their Redis, and the
merchant-login database deploy to Render, defined in `render.yaml`. Full
walkthrough: [`docs/deployment.md`](docs/deployment.md).

## Learn more

`CLAUDE.md` has the full architecture write-up: how the Shopify data layer,
auth, and cart cookies work, how the merchant portal and its login are built,
and how the two AI agents are wired up.

## Setup without Make

```bash
npm install
cp .env.example .env
```

Fill in `.env`, then:

```bash
npm run dev             # theme generator (watch) + next dev
npm run build            # theme generator + next build
npm run start            # start production server
npm run lint             # eslint on src/**/*.{js,jsx,ts,tsx}
npm run format           # prettier -w ./src
npm run remove-darkmode  # strip dark-mode support, then format
```

For the agents and the merchant portal's database, see each one's own README
(`shopping-agent/README.md`, `merchant-agent/README.md`) and the "Merchant
portal" steps in `CLAUDE.md`.
