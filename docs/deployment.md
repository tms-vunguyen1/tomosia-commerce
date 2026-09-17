# Deployment: Vercel + Render

Production only — no separate staging environment (Vercel's per-PR preview
deploys still happen automatically for the Next.js app; the two agents and
Postgres have one shared production instance each).

```
Vercel                                   Render
┌─────────────────────────┐              ┌───────────────────────────────┐
│ Next.js app (this repo,  │──HTTPS──────▶│ shopping-agent  (web, Docker) │
│ repo root)                │              │   + shopping-agent-redis      │
│  - storefront + /merchant │◀─HTTPS──────│                                │
│  - /api/internal/*         │              ├───────────────────────────────┤
│  - Prisma (merchant login) │──HTTPS──────▶│ merchant-agent  (web, Docker) │
└─────────────┬─────────────┘              │   + merchant-agent-redis      │
              │                            ├───────────────────────────────┤
              └───────────HTTPS───────────▶│ merchant-db  (Postgres)       │
                                            └───────────────────────────────┘
```

Why this split: Vercel doesn't run long-lived processes (the two FastAPI
sidecars need a persistent Redis connection), so they + their Postgres go to
Render instead — see the "Deploy topology" decision in the repo's `/grill-me`
history. All three Render-hosted pieces are declared in `render.yaml`
(a Blueprint) at the repo root; Vercel isn't part of that file — it has no
Render presence, so every value that crosses the Vercel/Render boundary is a
manual env var on both sides.

## 1. Render: deploy the Blueprint

Render Dashboard → **New** → **Blueprint** → point at this repo. It reads
`render.yaml` and provisions `shopping-agent`, `merchant-agent`, their two
Key Value (Redis) instances, and `merchant-db` (Postgres).

Every `sync: false` var in `render.yaml` has no value yet — Render will ask
for them during the Blueprint setup, or you fill them in per-service after.
For this first pass, set:

- `ANTHROPIC_API_KEY` on both agents (real value)
- Everything else that's `sync: false` (`STOREFRONT_API_URL`,
  `ASSISTANT_INTERNAL_TOKEN`, `ASSISTANT_ALLOWED_HOSTS` and their
  `MERCHANT_*` equivalents) — leave any placeholder for now; both services
  will crash-loop until step 3 gives you the real values. That's expected.

Once created, note from the Render dashboard:

- Each agent's `https://*.onrender.com` URL (its service page)
- `merchant-db`'s **External Connection String** (the database's Connections
  tab) — its `connectionString` inside `render.yaml` is the *internal* one,
  reachable only from other Render services, not from Vercel

## 2. Vercel: deploy the Next.js app

Vercel Dashboard → **New Project** → import this repo (root directory — no
monorepo config needed, the Python agents aren't part of the Next.js build).
Zero-config Next.js detection handles the rest. Set these env vars before the
first deploy (the build runs `prisma migrate deploy` — see
`scripts/migrateIfConfigured.mjs` — so `DATABASE_URL` must be set going in):

| Var | Value |
|---|---|
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_ACCESS_TOKEN`, `SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN`, `SHOPIFY_REVALIDATION_SECRET` | same as local `.env` |
| `DATABASE_URL` | `merchant-db`'s External Connection String from step 1 |
| `SHOPIFY_ADMIN_CLIENT_ID`, `SHOPIFY_ADMIN_CLIENT_SECRET` | same as local `.env` — see `CLAUDE.md`'s "Merchant agent" section for how these are issued |
| `ASSISTANT_API_URL` | the `shopping-agent` URL from step 1 |
| `ASSISTANT_INTERNAL_TOKEN` | a secret you pick — must match `shopping-agent`'s value on Render |
| `MERCHANT_ASSISTANT_API_URL` | the `merchant-agent` URL from step 1 |
| `MERCHANT_ASSISTANT_INTERNAL_TOKEN` | a secret you pick — must match `merchant-agent`'s value on Render |

Deploy, then note the resulting `https://*.vercel.app` URL (or your custom
domain).

## 3. Back to Render: fill in the real cross-service values

Now that both sides exist, go back to each Render service's Environment tab:

- `shopping-agent`: `STOREFRONT_API_URL` = the Vercel URL from step 2;
  `ASSISTANT_INTERNAL_TOKEN` = the same value set in Vercel;
  `ASSISTANT_ALLOWED_HOSTS` = `localhost,127.0.0.1,api,<shopping-agent's own
  onrender.com host>`
- `merchant-agent`: same three, using the `MERCHANT_*` var names and its own
  onrender.com host

Saving triggers a redeploy on Render. Once both agents' health checks go
green, the storefront's assistant modal and `/merchant`'s chat rail are live
end to end.

## Notes and trade-offs

- **Free plan cold starts**: `render.yaml` defaults every service to the
  `free` plan, which spins down after 15 minutes idle — the first chat
  message after a quiet period pays a cold-start. Bump `plan` in
  `render.yaml` (see Render's plan list) once this carries real traffic.
- **Postgres is open to the internet** (`ipAllowList: 0.0.0.0/0` on
  `merchant-db`): Vercel has no static outbound IPs to allowlist more
  narrowly, so access control is `DATABASE_URL`'s password alone. Fine for a
  demo/internal deployment; revisit (e.g. Vercel's static-IP add-on plus a
  narrower allowlist) before this holds real customer data.
- **`/merchant` is still direct-URL-only** — deploying it doesn't change
  that; see `CLAUDE.md`'s "Merchant portal" section.
- Redeploying either agent or the Next.js app independently is safe — they
  version their own contract (`ASSISTANT_INTERNAL_TOKEN` etc.), not a shared
  release train.
