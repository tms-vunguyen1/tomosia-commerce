# Todo: Merchant Login

See `tasks/plan-merchant-login.md` for full context and architecture
decisions, `SPEC-merchant-login.md` for the full spec.

### Phase 1: Database Foundation

- [x] Task 1.1: Add Prisma/bcrypt dependencies, root docker-compose, env vars
  - **Description:** Install the three new npm packages, add a root-level
    `docker-compose.yml` (separate compose project from
    `shopping-agent/docker-compose.yml`), and add `DATABASE_URL` to
    `.env`/`.env.example`. No application code changes — this only makes the
    tooling available.
  - **Acceptance criteria:**
    - [x] `bcrypt`, `@types/bcrypt`, `prisma`, `@prisma/client` appear in
          `package.json`/`package-lock.json` (via `npm install`).
    - [x] `docker-compose.yml` at repo root defines one `postgres` service
          (`postgres:16-alpine`), a named volume, port 5432 published — does
          not modify `shopping-agent/docker-compose.yml`.
    - [x] `.env.example` gains
          `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tomosia_merchant"`;
          local `.env` gets a working value (not committed).
  - **Verification:**
    - [x] `npm install bcrypt @types/bcrypt prisma @prisma/client` completes
          without native-build errors (see plan's bcrypt risk). Confirmed
          bcrypt's native binding actually loads (hash+compare round trip),
          not just that install exited 0.
    - [x] `docker compose up -d postgres` starts a healthy container;
          `docker compose ps` shows it distinct from any `shopping-agent`
          compose project (`tomosia-commerce-postgres-1`, default project
          name, no collision).
    - [x] `npm run build` still succeeds (nothing wired yet — sanity check).
  - **Dependencies:** None
  - **Files:**
    - `package.json` (`package-lock.json` is gitignored in this repo —
      pre-existing, not touched)
    - `docker-compose.yml` (new)
    - `.env`, `.env.example`
  - **Estimated scope:** Small (1-2 meaningful files; lockfile is generated)
  - **Notes:** npm's `prisma` "latest" dist-tag resolved to an `8.0.0-rc`
    prerelease while `@prisma/client` resolved to stable `7.10.0` — pinned
    `prisma` to `7.10.0` explicitly so CLI and client match. Also reverted
    two unrelated sitemap build artifacts (`public/sitemap.xml`,
    `public/sitemap-0.xml`) that `npm run build`'s `next-sitemap` postbuild
    step regenerated as a side effect — out of scope for this task.

- [ ] Task 1.2: Prisma schema + initial migration
  - **Description:** Define `MerchantUser` and `MerchantSession` models
    exactly as specified (single role, no permissions field) and run the
    first migration against the local Postgres container.
  - **Acceptance criteria:**
    - [ ] `prisma/schema.prisma` has `MerchantUser { id, email (unique),
          passwordHash, name, createdAt }` and `MerchantSession { id (opaque
          token, PK), userId → MerchantUser, expiresAt, createdAt }`.
    - [ ] `npx prisma migrate dev` runs cleanly against a fresh database and
          creates both tables.
    - [ ] Prisma's generated client lands in its default location
          (`node_modules/@prisma/client`) — no custom `output` path, so no
          new `.gitignore` entry needed.
  - **Verification:**
    - [ ] `docker compose up -d postgres && npx prisma migrate dev` — schema
          applies cleanly to a fresh DB (spec step 2).
    - [ ] Inspect via `npx prisma studio` or `psql` that both tables and the
          FK/unique constraints exist.
  - **Dependencies:** Task 1.1
  - **Files:**
    - `prisma/schema.prisma` (new)
    - `prisma/migrations/**` (generated)
  - **Estimated scope:** Small

- [ ] Task 1.3: `create-merchant-account.mjs` script
  - **Description:** The only way accounts get created — a standalone Node
    ESM script that hashes the password with bcrypt (cost 12) and inserts a
    `MerchantUser` row via its own `PrismaClient` instance.
  - **Acceptance criteria:**
    - [ ] `node scripts/create-merchant-account.mjs <email> <password>
          <name>` creates a row with a bcrypt hash (never the plaintext)
          stored.
    - [ ] Running it a second time with the same email fails on the unique
          constraint with a readable error, rather than silently duplicating
          or crashing unhelpfully.
  - **Verification:**
    - [ ] `node scripts/create-merchant-account.mjs owner@tomosia.test
          hunter2 "Store Owner"` creates the row (spec step 3); re-running
          with the same email fails as expected.
    - [ ] Confirm in the DB that `passwordHash` is not the literal password.
  - **Dependencies:** Task 1.2
  - **Files:**
    - `scripts/create-merchant-account.mjs` (new)
  - **Estimated scope:** Small

### Checkpoint: Phase 1 complete
- [ ] `docker compose up -d postgres` + `npx prisma migrate dev` reproducible
      from a clean clone.
- [ ] One seeded merchant account exists (`owner@tomosia.test`).
- [ ] `npm run lint` / `npm run build` still clean — zero application
      behavior changed yet; this phase is purely infrastructure.

---

### Phase 2: Auth Core Library

- [ ] Task 2.1: Prisma client singleton
  - **Description:** `src/lib/merchant/db.ts` — the standard Next.js
    `globalThis`-cached `PrismaClient` singleton, so dev's hot reload doesn't
    open a new connection pool per file edit.
  - **Acceptance criteria:**
    - [ ] Exports a single `prisma` instance.
    - [ ] In dev (`NODE_ENV !== "production"`), the instance is cached on
          `globalThis` so repeated hot-reloads reuse it.
  - **Verification:**
    - [ ] `npm run dev`, edit an unrelated file a few times, confirm no
          runaway connection growth (quick manual spot-check).
  - **Dependencies:** Task 1.2
  - **Files:**
    - `src/lib/merchant/db.ts` (new)
  - **Estimated scope:** XS

- [ ] Task 2.2: Auth logic + self-check
  - **Description:** `src/lib/merchant/auth.ts`, the single source of truth
    for merchant auth logic. Also add the one required self-check script
    (`scripts/test-merchant-auth.mjs`) covering the two pieces of
    non-trivial logic: hash/verify round-trip and session-expiry rejection.
  - **Acceptance criteria:**
    - [ ] `hashPassword`/`verifyPassword` use bcrypt at cost 12.
    - [ ] `createSession(userId)` writes a `MerchantSession` row with
          `expiresAt = now + MERCHANT_SESSION_TTL_MS` and returns the opaque
          token.
    - [ ] `getSessionUser(token)` returns `null` for a missing/unknown token
          **and** for a session whose `expiresAt` is in the past.
    - [ ] `deleteSession(token)` removes the row if present, no-ops
          otherwise.
    - [ ] `scripts/test-merchant-auth.mjs` is an `assert`-based script, no
          framework, that fails loudly if `verifyPassword` returns true for
          a wrong password or if `getSessionUser` accepts an expired
          session.
  - **Verification:**
    - [ ] `node scripts/test-merchant-auth.mjs` exits 0 (spec step 1).
    - [ ] `npm run lint` clean on the new file.
  - **Dependencies:** Task 2.1
  - **Files:**
    - `src/lib/merchant/auth.ts` (new)
    - `scripts/test-merchant-auth.mjs` (new)
  - **Estimated scope:** Small

- [ ] Task 2.3: Merchant cookie constants
  - **Description:** Add `MERCHANT_AUTH_COOKIE`, `MERCHANT_AUTH_COOKIE_OPTIONS`
    (`path: "/merchant"`, not `"/"`), and `MERCHANT_SESSION_TTL_MS` to
    `src/lib/constants.ts`, alongside (not replacing) the existing
    `AUTH_COOKIE`/`AUTH_COOKIE_OPTIONS`.
  - **Acceptance criteria:**
    - [ ] New constants added without modifying `AUTH_COOKIE`/
          `AUTH_COOKIE_OPTIONS`.
    - [ ] `MERCHANT_AUTH_COOKIE_OPTIONS.path === "/merchant"`.
  - **Verification:**
    - [ ] `npm run build` clean; grep confirms `AUTH_COOKIE`/
          `AUTH_COOKIE_OPTIONS` byte-identical to before this task.
  - **Dependencies:** None (can run in parallel with 2.1/2.2)
  - **Files:**
    - `src/lib/constants.ts`
  - **Estimated scope:** XS

### Checkpoint: Phase 2 complete
- [ ] `node scripts/test-merchant-auth.mjs` passes.
- [ ] `npm run lint` && `npm run build` clean.
- [ ] Still zero user-facing behavior change — `/merchant` remains open
      exactly as before.

---

### Phase 3: Route Gating & Login Flow

- [ ] Task 3.1: Middleware fast-path + login page stub
  - **Description:** Add `src/middleware.ts` (matcher `["/merchant/:path*"]`)
    that redirects any `/merchant/*` request lacking `MERCHANT_AUTH_COOKIE`
    to `/merchant/login?next=<path>`, except `/merchant/login` itself, which
    it lets through unconditionally. Add a bare-bones stub at
    `src/app/(merchant)/merchant/login/page.tsx` (no real form yet) so the
    redirect target renders instead of 404ing.
  - **⚠️ Interim state, not the real gate:** after this task the middleware
    only checks cookie *presence*, not validity, and the existing
    `merchant/page.tsx` is still directly reachable once any cookie exists.
    This is closed by Task 3.2 in the same phase, before the Phase 3
    checkpoint — don't treat this task alone as "login is secure."
  - **Acceptance criteria:**
    - [ ] Logged-out visit to `/merchant` (no cookie, zero path segments)
          redirects to `/merchant/login`.
    - [ ] Logged-out visit to `/merchant/orders` redirects to
          `/merchant/login?next=%2Fmerchant%2Forders`.
    - [ ] `/merchant/login` itself renders (stub content is fine) with no
          redirect loop, cookie or not.
    - [ ] `next` is validated as a same-origin relative path
          (`next.startsWith("/") && !next.startsWith("//")`) before being
          used in the redirect.
    - [ ] Middleware does not import anything from `src/lib/merchant/db.ts`
          or `auth.ts` — cookie check only.
  - **Verification:**
    - [ ] Manual: clear cookies, visit `/merchant` and `/merchant/orders`,
          confirm redirect target and query string.
    - [ ] `npm run build` succeeds (confirms middleware compiles for the
          Edge runtime).
  - **Dependencies:** Task 2.3
  - **Files:**
    - `src/middleware.ts` (new)
    - `src/app/(merchant)/merchant/login/page.tsx` (new, stub)
  - **Estimated scope:** Small

- [ ] Task 3.2: Real session gate — move portal into `(dashboard)` group
  - **Description:** Create
    `src/app/(merchant)/merchant/(dashboard)/layout.tsx`, a server component
    that reads `MERCHANT_AUTH_COOKIE` via `cookies()`, calls
    `getSessionUser(token)`, and `redirect("/merchant/login?next=" +
    currentPath)` on any missing/invalid/expired session. Move today's
    `src/app/(merchant)/merchant/page.tsx` client-component body into
    `src/layouts/merchant/shell/PortalApp.tsx` unchanged, and replace
    `merchant/page.tsx` with a new thin server component at
    `(dashboard)/page.tsx` that reads the now-validated session user and
    renders `PortalApp` with `operator={{ name: user.name, role:
    "Merchant" }}` — **update both hardcoded `"Jordan"` sites**: the
    `PortalShell` `operator` prop and the separate `HomeView
    operator="Jordan"` prop.
  - **Acceptance criteria:**
    - [ ] `/merchant` with a missing/invalid/expired cookie redirects to
          `/merchant/login?next=%2Fmerchant`; this closes the gap left open
          by Task 3.1.
    - [ ] `/merchant` with a valid session renders the portal with the real
          user's name in both the `PortalShell` operator block and the
          `HomeView` welcome text — no remaining literal `"Jordan"` anywhere
          in the moved code.
    - [ ] `PortalApp.tsx` content is otherwise byte-identical to today's
          `page.tsx` body (a move, not a rewrite).
    - [ ] No database call happens inside `src/middleware.ts`.
  - **Verification:**
    - [ ] Manually insert a session row for the seeded account (acceptable
          to test this task before Task 3.3's login route exists) and
          confirm `/merchant` renders with the real name.
    - [ ] Delete/expire that row, confirm redirect reappears.
    - [ ] `npm run lint` && `npm run build` clean.
  - **Dependencies:** Task 3.1, Task 2.2
  - **Files:**
    - `src/app/(merchant)/merchant/(dashboard)/layout.tsx` (new)
    - `src/app/(merchant)/merchant/(dashboard)/page.tsx` (new, thin server
      component)
    - `src/layouts/merchant/shell/PortalApp.tsx` (new, moved from old
      `merchant/page.tsx`)
    - `src/app/(merchant)/merchant/page.tsx` (deleted — content moved)
  - **Estimated scope:** Medium

- [ ] Task 3.3: Login API route + real login form
  - **Description:** Build `POST /api/merchant/login` following the exact
    shape in the spec's Code Style section (thin handler, generic 401 for
    both unknown-email and wrong-password, no enumeration), and replace the
    Task 3.1 stub with the real login form: email/password fields, reads
    `?next=`, submits to the API, redirects to `next` (validated) or
    `/merchant` on success, shows one generic inline error on failure.
  - **Acceptance criteria:**
    - [ ] Correct credentials → `MerchantSession` row created,
          `MERCHANT_AUTH_COOKIE` set with `MERCHANT_AUTH_COOKIE_OPTIONS`,
          redirect lands on exactly the `next` path (or `/merchant` if
          none/invalid).
    - [ ] Wrong password, and unknown email, both return the same generic
          error message and HTTP status; confirm in the DB that no
          `MerchantSession` row is created in either case.
    - [ ] `next` validated as a same-origin relative path on the client
          before it's ever used in a redirect.
    - [ ] Login page visually uses `merchant.css` tokens (`bg-(--card)`,
          `text-(--ink)`, etc.), not storefront styling.
    - [ ] A logged-in visit to `/merchant/login` still renders (no forced
          redirect away) — per spec's explicit success criterion.
  - **Verification:**
    - [ ] Manual: logged out, visit `/merchant/orders`, get redirected with
          `?next=`, submit correct seeded credentials, land back on exactly
          `/merchant/orders` with real name in chrome (spec steps 4-5).
    - [ ] Manual: submit wrong password, confirm single generic error, no
          redirect, no new session row (spec step 6).
    - [ ] `npm run lint` && `npm run build` clean.
  - **Dependencies:** Task 3.2, Task 2.2, Task 1.3
  - **Files:**
    - `src/app/api/merchant/login/route.ts` (new)
    - `src/app/(merchant)/merchant/login/page.tsx` (replaces stub with real
      form)
  - **Estimated scope:** Medium

### Checkpoint: Phase 3 complete — recommended human check-in
- [ ] Full logged-out → login → correct-credentials → portal loop works end
      to end against the seeded account.
- [ ] Wrong-credentials path verified to create no session row.
- [ ] `npm run lint` && `npm run build` clean.
- [ ] This is the first checkpoint where real auth is enforced — good place
      to sanity-check the open-redirect guard and generic-error behavior
      before building logout/UI on top.

---

### Phase 4: Logout + UI Wiring

- [ ] Task 4.1: Logout API + "Log out" control in the portal shell
  - **Description:** `POST /api/merchant/logout` deletes the
    `MerchantSession` row for the current cookie (if any) and clears the
    cookie, always succeeding (mirrors `src/app/api/customer/logout/route.ts`).
    Add a small "Log out" control beside the existing operator block in
    `PortalShell.tsx` (~lines 135-141), wired through a new `onLogout: () =>
    void` prop that `PortalApp.tsx` implements as `POST
    /api/merchant/logout` then redirect to `/merchant/login`.
  - **Acceptance criteria:**
    - [ ] Clicking "Log out" clears `MERCHANT_AUTH_COOKIE` (DevTools →
          Application → Cookies) and deletes the corresponding
          `MerchantSession` row.
    - [ ] After logout, the next visit to `/merchant` (or any dashboard
          path) redirects to login again — no residual valid state.
    - [ ] Logout API always returns success even if no cookie/session
          existed.
    - [ ] `PortalShell.tsx`'s existing operator name/role rendering is
          unchanged in appearance apart from the added control.
  - **Verification:**
    - [ ] Manual: log in, click "Log out", confirm cookie gone, DB row gone,
          and `/merchant` redirects to login (spec step 7).
    - [ ] `npm run lint` && `npm run build` clean.
  - **Dependencies:** Task 3.3, Task 2.2
  - **Files:**
    - `src/app/api/merchant/logout/route.ts` (new)
    - `src/layouts/merchant/shell/PortalShell.tsx` (modified — add
      `onLogout` prop + control)
    - `src/layouts/merchant/shell/PortalApp.tsx` (modified — implement
      `onLogout`)
  - **Estimated scope:** Small

### Checkpoint: Phase 4 complete
- [ ] Full narrative loop verified: logged-out redirect → login form →
      correct-credential success → portal with real name → logout →
      redirected to login again.
- [ ] `npm run lint` && `npm run build` clean.

---

### Phase 5: Polish & Full Verification

- [ ] Task 5.1: Session-expiry and cross-cookie isolation verification pass
  - **Description:** No new production code expected (expiry logic already
    exists from Task 2.2, cookie scoping from Task 2.3) — this task is
    dedicated to running the spec's remaining, previously-unexercised
    verification steps and fixing anything they surface.
  - **Acceptance criteria:**
    - [ ] Manually expiring a `MerchantSession.expiresAt` to the past and
          reloading `/merchant` redirects to login, identical to a missing
          session (spec step 8).
    - [ ] The merchant cookie never appears on a storefront request (`/`,
          `/products/...`), and the customer `token` cookie never appears on
          a `/merchant/*` request (DevTools → Network → Cookies, spec step
          9).
    - [ ] No file under `src/lib/shopify/**`, `src/app/api/customer/**`, or
          `cartActions.ts` was modified anywhere in this feature.
    - [ ] No npm dependency beyond `bcrypt`, `@types/bcrypt`, `prisma`,
          `@prisma/client` was added.
  - **Verification:**
    - [ ] All 10 steps in `SPEC-merchant-login.md`'s Testing Strategy pass
          in order, fresh.
    - [ ] `npm run lint` && `npm run build` — clean, zero new warnings (spec
          step 10).
    - [ ] `git diff --stat` reviewed against the Success Criteria's file-
          boundary list.
  - **Dependencies:** Task 4.1
  - **Files:** none expected; fixes only if a gap is found (most likely
    candidates: `src/middleware.ts` matcher edge cases,
    `MERCHANT_AUTH_COOKIE_OPTIONS.path`).
  - **Estimated scope:** XS-S (verification; code changes only if a defect
    surfaces)

### Checkpoint: Feature complete
- [ ] All acceptance criteria across Phases 1-5 met.
- [ ] Ready for human review / merge.
