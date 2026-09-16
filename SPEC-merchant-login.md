# Spec: Merchant Login

## Objective

Gate the existing `/merchant` portal (`SPEC-merchant-portal.md`, currently a
fixture-only UI shell reachable by direct URL with **no auth**) behind a real
login, so only a known store operator can open it.

This is an **auth-only** deliverable: it adds identity and a session, and
nothing else. It does not wire the portal's views to live data, does not add
a merchant-agent backend, and does not reverse the "Role: shopping agent
only. No merchant agent." decision recorded in `CLAUDE.md` — that decision is
about the Python agent sidecar and is unrelated to this UI's own login.

**User:** an internal Tomosia store operator (staff/owner), not a Shopify
customer and not a Shopify Admin/staff account — Shopify has no API to verify
an individual staff member's password, so this is a wholly separate merchant
identity, provisioned by hand, one person at a time.

**Success looks like:** visiting `/merchant` while logged out redirects to
`/merchant/login`; submitting a correct email/password creates a session and
lands on the portal (or wherever `/merchant` originally sent them, via
`?next=`); a wrong password shows one generic error and creates nothing;
logging out ends the session immediately and the next visit to `/merchant`
redirects to login again; nothing here calls Shopify's Storefront or Admin
API, and nothing here touches the customer auth cookie.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript — existing.
- **New:** PostgreSQL, accessed through Prisma ORM (`prisma` CLI +
  `@prisma/client`) — this app's first database. Runs via a **new root-level
  `docker-compose.yml`**, separate from `shopping-agent/docker-compose.yml`
  (whose project name is pinned to `shopping-agent` for a different service —
  see `CLAUDE.md`). No `pg` driver package needed; Prisma's Postgres
  connector handles the connection itself.
- **New:** `bcrypt` (+ `@types/bcrypt`) for password hashing. No JWT library,
  no Auth.js/NextAuth — sessions are hand-rolled, matching the existing
  `src/app/api/customer/*` convention (custom route handler, `cookies()`
  from `next/headers`, no framework).
- These three new dependencies were confirmed in the `grill-me` interview
  that produced this spec; no others are authorized without asking first.

## Commands

Same base commands as the rest of the repo, plus new ones for the database:

- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Format: `npm run format`
- Start Postgres: `docker compose up -d postgres`
- Apply schema (dev): `npx prisma migrate dev`
- Create a merchant account: `node scripts/create-merchant-account.mjs <email> <password> <name>`
- No test runner is configured; verification is manual, plus one small
  self-check script (below).

## Project Structure

```
docker-compose.yml              ← NEW, root-level. One service, `postgres`
                                   (postgres:16-alpine), named volume for
                                   data, port 5432. Its own compose project
                                   (named after this directory, same default
                                   Docker Compose already uses) — independent
                                   of shopping-agent's compose project.

prisma/
  schema.prisma                 ← NEW. Two models:
                                   MerchantUser    { id, email (unique),
                                                     passwordHash, name,
                                                     createdAt }
                                   MerchantSession { id (opaque token, PK),
                                                     userId (→ MerchantUser),
                                                     expiresAt, createdAt }
                                   Single role for both — no role/permission
                                   field (per interview: one tier of access).

scripts/
  create-merchant-account.mjs   ← NEW. Plain Node ESM script (no ts-node/tsx
                                   dependency): takes email/password/name as
                                   argv, hashes the password with bcrypt,
                                   inserts a MerchantUser via Prisma. The only
                                   way accounts are created — no self-service
                                   sign-up route exists.

src/lib/merchant/
  db.ts                         ← NEW. Prisma client singleton (the standard
                                   Next.js `globalThis` caching pattern, so
                                   dev's hot-reload doesn't open a new pool
                                   per edit).
  auth.ts                       ← NEW. Single source of truth for merchant
                                   auth: hashPassword/verifyPassword (bcrypt,
                                   cost 12), createSession (writes
                                   MerchantSession, returns the token),
                                   getSessionUser(token) (reads + expiry-
                                   checks a session, used by the dashboard
                                   layout below), deleteSession(token).

src/lib/constants.ts             ← MODIFIED. Add, alongside the existing
                                   AUTH_COOKIE / AUTH_COOKIE_OPTIONS:
                                     MERCHANT_AUTH_COOKIE = "merchant_session"
                                     MERCHANT_AUTH_COOKIE_OPTIONS = {
                                       httpOnly: true,
                                       secure: prod,
                                       sameSite: "lax",
                                       path: "/merchant",   // ← scoped, unlike
                                     }                       //   the "/" customer
                                                              //   cookie — never
                                                              //   sent to storefront
                                                              //   or agent routes.
                                     MERCHANT_SESSION_TTL_MS = 8 * 60 * 60 * 1000

src/app/(merchant)/merchant/api/    ← NEW. NOT src/app/api/merchant/** — see
                                   Amendment below. URLs: /merchant/api/login,
                                   /merchant/api/logout.
  login/route.ts                ← POST { email, password }. Looks up
                                   MerchantUser, bcrypt-compares, on success
                                   creates a session and sets
                                   MERCHANT_AUTH_COOKIE; on any failure
                                   (unknown email OR wrong password) returns
                                   the same generic 401 — no user enumeration.
  logout/route.ts               ← POST. Deletes the MerchantSession row
                                   for the current cookie (if any) and clears
                                   the cookie. Always succeeds.

src/middleware.ts                ← NEW. matcher: ["/merchant/:path*"]. Runs
                                   on the Edge runtime, so it does NOT touch
                                   Prisma — it only checks whether
                                   MERCHANT_AUTH_COOKIE is present, and lets
                                   `/merchant/login`, `/merchant/api/login`,
                                   and `/merchant/api/logout` through
                                   unconditionally (PUBLIC_PATHS). Missing
                                   cookie + any other /merchant path →
                                   redirect to `/merchant/login?next=<path>`.
                                   This is a fast reject for the common case;
                                   it is not the real check (see below).

**Amendment (found during Task 4.1 verification, not anticipated when this
spec was written):** this section originally placed the two routes at
`src/app/api/merchant/{login,logout}/route.ts`, mirroring
`src/app/api/customer/**`. That breaks logout: `MERCHANT_AUTH_COOKIE_OPTIONS`
scopes the cookie to `path: "/merchant"`, and browsers match a cookie's
`Path` against URL path *segments* — `/api/merchant/logout` does not fall
under `/merchant`, so the cookie is never sent there. Logout appeared to
work (200 response, cookie cleared client-side) but never deleted the
database session row. Moving both routes under the `(merchant)` route group
so their URLs are `/merchant/api/*` fixes this while preserving the
Boundaries section's explicit requirement to keep the cookie's path scoped
away from storefront/agent traffic (the alternative fix — widening the
cookie to `path: "/"` — was rejected as a reversal of that requirement).

src/app/(merchant)/
  layout.tsx                     ← UNCHANGED. Still just the independent
                                   <html>/<body> shell; still applies to both
                                   the login page and the dashboard.
  merchant/
    login/
      page.tsx                   ← NEW. The login form. No session check —
                                   reachable whether or not a valid session
                                   exists. Reads `?next=` from the URL and
                                   submits it back to the API so a successful
                                   login returns to the right page.
    (dashboard)/                 ← NEW route group (no effect on the URL —
                                   the page below is still exactly `/merchant`).
      layout.tsx                 ← NEW. Server component. Reads
                                   MERCHANT_AUTH_COOKIE, calls
                                   getSessionUser(token). No valid, unexpired
                                   session → redirect("/merchant/login?next="
                                   + currentPath). This is the REAL gate —
                                   the one place that actually hits the
                                   database; the middleware above is only a
                                   fast, best-effort pre-filter for the
                                   common logged-out case.
      page.tsx                   ← MOVED from today's
                                   src/app/(merchant)/merchant/page.tsx, no
                                   content changes except: it becomes a thin
                                   server component that reads the session
                                   user's name (already validated by the
                                   layout above) and renders the existing
                                   client component (moved to
                                   src/layouts/merchant/shell/PortalApp.tsx)
                                   with `operator={{ name: user.name, role:
                                   "Merchant" }}` instead of the hardcoded
                                   `{ name: "Jordan", role: "Store manager" }`.

src/layouts/merchant/shell/
  PortalApp.tsx                  ← NEW (renamed from today's
                                   merchant/page.tsx body — the `"use client"`
                                   component with all the view-switching
                                   state). Same content, just relocated so a
                                   server component can own the session read.
  PortalShell.tsx                ← MODIFIED. The existing bottom-of-rail
                                   operator block (name + role, PortalShell.tsx:136-142)
                                   gets one addition: a small "Log out"
                                   control beside it, wired to a new
                                   `onLogout: () => void` prop that
                                   `PortalApp.tsx` implements as
                                   `POST /merchant/api/logout` then a
                                   redirect to `/merchant/login`.

.env / .env.example              ← MODIFIED. Add:
                                     DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tomosia_merchant"

.gitignore                       ← MODIFIED. Add the Prisma-generated client
                                   output path if it lands outside
                                   node_modules (default location is inside
                                   node_modules/@prisma/client, already
                                   ignored — confirm at implementation time,
                                   add an entry only if needed).
```

## Code Style

Match the existing `src/app/api/customer/*/route.ts` shape exactly — a thin
route handler, no service-class abstraction, cookie set via `cookies()`,
generic errors on the JSON body:

```ts
// src/app/(merchant)/merchant/api/login/route.ts (shape, not final code)
import { MERCHANT_AUTH_COOKIE, MERCHANT_AUTH_COOKIE_OPTIONS } from "@/lib/constants";
import { verifyPassword, createSession } from "@/lib/merchant/auth";
import { prisma } from "@/lib/merchant/db";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.merchantUser.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(MERCHANT_AUTH_COOKIE, token, MERCHANT_AUTH_COOKIE_OPTIONS);
  return NextResponse.json({ name: user.name });
}
```

- No `"use server"` server actions for this — matches the existing
  route-handler convention for auth, not the cart's server-action convention.
- `next` query param: validated as a same-origin relative path
  (`next.startsWith("/") && !next.startsWith("//")`) before ever being used in
  a redirect, on both the middleware and the API — an unchecked value here is
  an open-redirect bug, not a style choice.
- Prettier + `prettier-plugin-tailwindcss` still applies to the login page's
  markup; it reads `merchant.css` tokens the same way the rest of the portal
  does (`bg-(--card)`, `text-(--ink)`, etc.) — it is visually part of the
  portal, not a generic auth page.

## Testing Strategy

No test runner is configured (per `CLAUDE.md`). Verification is manual, plus
one small script:

1. `scripts/test-merchant-auth.mjs` (or `src/lib/merchant/auth.test-manual.mjs`
   — exact name decided at implementation time): an `assert`-based
   self-check, no framework, covering the two pieces of non-trivial logic
   this feature introduces: a hash/verify round trip (`verifyPassword` true
   for the right password, false for a wrong one) and session expiry math
   (a session with `expiresAt` in the past is rejected by `getSessionUser`).
   Run with `node scripts/test-merchant-auth.mjs`.
2. `docker compose up -d postgres && npx prisma migrate dev` — schema applies
   cleanly to a fresh database.
3. `node scripts/create-merchant-account.mjs owner@tomosia.test hunter2 "Store Owner"`
   — creates a row; running it again with the same email fails on the unique
   constraint rather than silently duplicating.
4. Logged out, visit `/merchant/orders` (or any dashboard path) — redirected
   to `/merchant/login?next=%2Fmerchant%2Forders`.
5. Submit the seeded credentials — redirected back to exactly
   `/merchant/orders`, portal chrome shows the real name in the operator
   block (not "Jordan").
6. Submit a wrong password — one generic error shown, no redirect, and
   confirm in the DB that no `MerchantSession` row was created.
7. Click "Log out" — cookie is cleared (DevTools → Application → Cookies),
   the `MerchantSession` row is gone from the DB, and `/merchant` immediately
   redirects to login again.
8. Manually expire a session (set `expiresAt` to the past directly in the
   DB) and reload `/merchant` — redirected to login, same as a missing
   session.
9. Confirm the merchant cookie never appears on a storefront request
   (DevTools → Network → any `/`, `/products/...` request → Cookies) and the
   customer `token` cookie never appears on a `/merchant/*` request.
10. `npm run lint` and `npm run build` — clean.

## Boundaries

- **Always do:** hash every password with bcrypt before it touches the
  database — never log or store one in plaintext; keep
  `MERCHANT_AUTH_COOKIE` separate in name and `path` from the customer's
  `AUTH_COOKIE`; validate `next` as a same-origin relative path before any
  redirect; return the same generic error for "no such email" and "wrong
  password"; keep `src/lib/merchant/**` as the only place that touches
  `MerchantUser`/`MerchantSession` (routes and the dashboard layout call
  into it, they don't query Prisma directly).
- **Ask first:** any npm dependency beyond `bcrypt`/`prisma`/`@prisma/client`;
  adding roles or permissions; adding self-service sign-up or a
  forgot-password flow; adding brute-force/rate-limiting protection to
  login (explicitly deferred in the interview, not forgotten); running the
  new Postgres service inside `shopping-agent/docker-compose.yml` instead of
  its own root compose file; editing the "no merchant agent" decision record
  in `CLAUDE.md`.
- **Never do:** call `src/lib/shopify/**` from any file under
  `src/lib/merchant/**` or `src/app/(merchant)/merchant/api/**`; touch
  `src/app/api/customer/**`, `cartActions.ts`, `AUTH_COOKIE`, or
  `AUTH_COOKIE_OPTIONS`; run session verification against the database
  inside `src/middleware.ts` (Edge runtime — verification belongs in the
  `(dashboard)/layout.tsx` server component); commit `.env` or a real
  `DATABASE_URL` password; expose a password hash or session token to
  client-side JavaScript.

## Success Criteria

- All 10 steps in Testing Strategy pass.
- `npm run lint` and `npm run build` succeed with no new errors/warnings.
- No file under `src/lib/shopify/**`, `src/app/api/customer/**`, or
  `cartActions.ts` is modified.
- The only new npm dependencies are `bcrypt`, `@types/bcrypt`, `prisma`,
  `@prisma/client`.
- A logged-out visit to any `/merchant/*` path (except `/merchant/login`)
  always redirects to login; a logged-in visit to `/merchant/login` is
  allowed to render (no forced redirect away — a merchant may want to log
  into a different account without logging out first, and it's one fewer
  edge case to special-case for no real benefit).

## Open Questions

- Exact visual design of `/merchant/login` (copy, layout within
  `merchant.css` tokens) is drafted at implementation time — no specific
  design was dictated beyond "matches the portal's palette, not the
  storefront's."
- Whether `docker-compose.yml` should pin an explicit `name:` (compose
  project name) is left to implementation; Docker Compose's default
  (directory name) already avoids colliding with `shopping-agent`'s pinned
  project name, so this is only worth revisiting if that default ever causes
  friction.
