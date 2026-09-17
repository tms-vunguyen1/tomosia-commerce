# Implementation Plan: Merchant Login

## Overview

`spec.md` calls for gating the existing, currently-open
`/merchant` portal behind a hand-rolled, cookie-session login backed by a new
Postgres+Prisma database — the repo's first database. Auth mirrors the
existing `src/app/api/customer/*` route-handler convention (thin handler,
`cookies()` from `next/headers`, generic errors); no Auth.js, no JWT. This
plan breaks that spec into five dependency-ordered, vertically-sliced phases,
each ending in a checkpoint that leaves the app in a working state. See
`spec.md` for full behavior/boundaries detail and
`/Users/vu.nguyen/.claude/plans/serialized-wandering-hippo.md` for the
reviewed/approved plan-mode summary this was generated from.

Exploration findings that shape the approach:
- `src/app/(merchant)/merchant/page.tsx` (`"use client"`) hardcodes the
  operator in **two places**: `operator={{ name: "Jordan", role: "Store
  manager" }}` passed to `PortalShell`, and a separate `operator="Jordan"`
  passed to `HomeView`. Both must be wired to the real session user — easy to
  fix only one.
- `PortalShell.tsx`'s operator block (avatar + name/role, ~lines 135-141, at
  the bottom of the nav rail) is where the "Log out" control is added, via a
  new `onLogout` prop.
- `src/app/api/customer/login/route.ts` / `logout/route.ts` and
  `src/lib/constants.ts` (`AUTH_COOKIE`/`AUTH_COOKIE_OPTIONS`) are the exact
  patterns to mirror for the merchant equivalents.
- Nothing Prisma/bcrypt/docker-compose-related exists yet in the repo. No
  test runner is configured anywhere (per `CLAUDE.md`).
- `package.json` declares `packageManager: yarn` but `package-lock.json` is
  the real lockfile (pre-existing inconsistency, not in scope to fix) — use
  `npm install`/`npm run` throughout.
- `shopping-agent/docker-compose.yml` exists for an unrelated Python sidecar
  and its compose project name is deliberately pinned — this feature's
  Postgres gets its own, separate root-level `docker-compose.yml`.

## Architecture Decisions

(Already fixed by `spec.md` via the `/grill-me` interview —
recorded here for quick reference, not reopened.)

1. **Opaque DB-backed sessions, not JWT.** `MerchantSession` rows in
   Postgres; the cookie only carries a random token. Easy to revoke
   (logout), no signing library needed.
2. **`MERCHANT_AUTH_COOKIE` is `path`-scoped to `/merchant`.** Structurally
   incapable of being sent on storefront or shopping-agent requests, and
   distinct in name from the customer's `AUTH_COOKIE` (`path: "/"`).
3. **Two-tier gate.** `src/middleware.ts` (Edge runtime) only checks cookie
   *presence* — never touches Prisma. The real, DB-backed check lives in
   `src/app/(merchant)/merchant/(dashboard)/layout.tsx`, a server component.
   This keeps Prisma out of the Edge runtime entirely.
4. **`src/lib/merchant/**` is the only code that queries `MerchantUser`/
   `MerchantSession`.** Routes and the dashboard layout call into it; they
   never construct a Prisma query directly. Single source of truth for auth
   logic (hash/verify, session create/read/delete).
5. **No self-service sign-up, no forgot-password, no roles, no brute-force
   guard.** All explicitly deferred in the interview; accounts are created
   only via `scripts/create-merchant-account.mjs`.

## Task List

### Phase 1: Database Foundation
- [ ] Task 1.1: Add Prisma/bcrypt dependencies, root docker-compose, env vars
- [ ] Task 1.2: Prisma schema + initial migration
- [ ] Task 1.3: `create-merchant-account.mjs` script

### Checkpoint: Phase 1
- [ ] `docker compose up -d postgres && npx prisma migrate dev` reproducible
      from a clean clone
- [ ] One seeded merchant account exists
- [ ] `npm run lint` / `npm run build` clean — zero app behavior changed yet

### Phase 2: Auth Core Library
- [ ] Task 2.1: Prisma client singleton
- [ ] Task 2.2: Auth logic (`hashPassword`/`verifyPassword`/`createSession`/
      `getSessionUser`/`deleteSession`) + `test-merchant-auth.mjs` self-check
- [ ] Task 2.3: Merchant cookie constants

### Checkpoint: Phase 2
- [ ] `node scripts/test-merchant-auth.mjs` passes
- [ ] `npm run lint` / `npm run build` clean
- [ ] `/merchant` still wide open exactly as before — zero user-facing change

### Phase 3: Route Gating & Login Flow
- [ ] Task 3.1: Middleware fast-path + login page stub
- [ ] Task 3.2: Real session gate — move portal into `(dashboard)` route group
- [ ] Task 3.3: Login API route + real login form (success + failure paths)

### Checkpoint: Phase 3 — recommended human check-in
- [ ] Full logged-out → login → correct-credentials → portal loop works
      end to end against the seeded account
- [ ] Wrong-credentials path verified to create no session row
- [ ] `npm run lint` / `npm run build` clean
- [ ] First point where real auth + the open-redirect guard are live —
      good place to sanity-check before building logout/UI on top

### Phase 4: Logout + UI Wiring
- [ ] Task 4.1: Logout API + "Log out" control in the portal shell

### Checkpoint: Phase 4
- [ ] Full narrative loop verified: logged-out redirect → login → success →
      portal with real name → logout → redirected to login again
- [ ] `npm run lint` / `npm run build` clean

### Phase 5: Polish & Full Verification
- [ ] Task 5.1: Session-expiry and cross-cookie isolation verification pass

### Checkpoint: Feature complete
- [ ] All acceptance criteria across Phases 1-5 met
- [ ] All 10 steps in `spec.md`'s Testing Strategy pass fresh
- [ ] Ready for human review / merge

Full task detail (description, acceptance criteria, verification,
dependencies, files, scope) lives in `todo.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **bcrypt native binary** — Node v26.5.0 is very new; bcrypt's native binding may lack a prebuilt binary for this ABI, forcing a node-gyp compile that can fail without a build toolchain. | High (blocks Phase 2) | `npm install bcrypt` in isolation as the very first step of Task 1.1, before writing any code against it. A build failure here is an "ask first" moment (dependency boundary) — not a silent swap to `bcryptjs`. |
| **Middleware placed at wrong layer** — importing `src/lib/merchant/db.ts`/`auth.ts` (Prisma) into `src/middleware.ts` fails at the Edge runtime. | Medium | Task 3.1 scopes middleware to a raw cookie-presence check only; Task 3.2's server-component layout is the sole place calling `getSessionUser`. `npm run build` after each is expected to surface an Edge-incompatible import immediately. |
| **Prisma singleton + dev hot-reload** — a fresh `PrismaClient` per file edit exhausts Postgres's connection limit during a long dev session. | Low-Medium | Task 2.1 uses the documented `globalThis`-caching pattern; spot-check connection count during a dev session with several edits. |
| **Two hardcoded `"Jordan"` sites** — `PortalShell` operator prop and the separate `HomeView operator="Jordan"` prop; fixing only the first leaves a stale demo name in the Home view welcome text. | Low (cosmetic trap) | Called out explicitly in Task 3.2's acceptance criteria; grep for `"Jordan"` across `src/layouts/merchant/` and `src/app/(merchant)/**` before closing that task. |
| **Middleware matcher edge case** — `"/merchant/:path*"` must match the bare `/merchant` path (zero segments), not just `/merchant/*`. | Low | Task 3.1's acceptance criteria explicitly test `/merchant` bare, not just a sub-path. |
| **`package.json` says yarn, lockfile is npm** — pre-existing inconsistency. | Low | Use `npm install`/`npm run` throughout; do not "fix" the `packageManager` field — out of scope. |
| **Compose project name collision with `shopping-agent`** | Low | Docker Compose's default project name (root directory name) already differs from `shopping-agent`'s pinned name; no explicit `name:` needed unless testing reveals a collision. |

## Open Questions

- Exact visual design/copy of `/merchant/login` — deferred to Task 3.3's
  implementation, constrained to "matches the portal's palette
  (`merchant.css` tokens), not the storefront's."
- Whether `docker-compose.yml` needs an explicit `name:` — deferred to
  Task 1.1, revisit only if the default causes a real collision.
