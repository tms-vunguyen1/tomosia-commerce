# Todo: Merchant Portal UI Shell

See `tasks/plan-merchant-portal.md` for full context and architecture
decisions, `SPEC-merchant-portal.md` for the full spec.

### Phase 0: Routing foundation

- [x] Task 1: Route split + placeholder `/merchant` page
  - **Description:** Move every existing route into `src/app/(storefront)/`
    unchanged (`git mv`), and add an independent `src/app/(merchant)/` root
    layout plus a placeholder `/merchant` page, so the two-root-layout split
    is proven before any real UI is built on top of it.
  - **Acceptance criteria:**
    - [x] `src/app/(storefront)/` contains today's `layout.tsx`, `page.tsx`,
          `not-found.tsx`, `[regular]/`, `about/`, `contact/`, `products/`,
          `(auth)/` with byte-identical content.
    - [x] `src/app/(merchant)/layout.tsx` renders its own `<html>/<body>`, no
          `Header`/`Footer`/`Providers`/`Cart`/`AssistantButton`.
    - [x] `src/app/(merchant)/merchant/page.tsx` renders a placeholder
          ("Merchant portal — under construction" or similar).
    - [x] `src/app/api/**` untouched.
    - [x] A 404 (nonexistent path) still resolves correctly.
  - **Verification:**
    - [x] `npm run build` — clean (all storefront + `/merchant` routes
          listed in the route table, `/merchant` prerendered static, no
          `not-found`/multi-root-layout conflict).
    - [x] `npm run dev`, manually visited `/`, `/login`, a bogus path
          (404), and `/merchant` via Chrome DevTools MCP — storefront
          routes render unchanged with full Header/Footer/AssistantButton
          chrome; `/merchant` renders only the placeholder, its own
          "Merchant Portal" title, no storefront chrome; zero console
          errors on any page (the 404 page's single console line is the
          expected network-status log for the missing resource, not a bug).
    - [x] `npm run lint` — clean.
    - Note: found and cleared a stale `.next/dev/lock` left by a crashed
      prior session (referenced a dead PID) that was blocking `next dev`
      from binding port 3000 — unrelated to this change, safe to remove
      (build cache, not git-tracked).
  - **Dependencies:** None
  - **Files:**
    - `src/app/(storefront)/**` (moved from `src/app/**`)
    - `src/app/(merchant)/layout.tsx` (new)
    - `src/app/(merchant)/merchant/page.tsx` (new)
  - **Estimated scope:** Medium (mostly file moves, 2 new files)

## Checkpoint: Phase 0
- [ ] `npm run build` && `npm run dev` clean
- [ ] Every existing storefront route unaffected
- [ ] `/merchant` loads the placeholder, no storefront chrome
- [ ] Review with human before proceeding

### Phase 1: Shared foundation

- [x] Task 2: Palette + data types + formatters
  - **Description:** Add the merchant portal's own design tokens and the
    TypeScript data layer every later task builds on.
  - **Acceptance criteria:**
    - [x] `src/styles/merchant.css` defines the ACME-derived token palette
          (`--ink`, `--accent`, `--brand`, `--ok`/`--warn`/`--danger`/
          `--info`/`--violet`, `--radius`, `--shadow*`, etc.) and is imported
          only by `(merchant)/layout.tsx`.
    - [x] `lib/types.ts` defines `Listing`, `ListingDetails`, `PricingContext`,
          `BusinessSnapshot`, `InventoryAlert`, `OrderIssue`, `StagedChange`,
          `RecentOrder`, `OverviewResponse`, `ListingsResponse`,
          `AlertsResponse`, and the presentation payload types
          (`MetricsPayload`, `DigestPayload`, `ChangePreviewPayload`).
    - [x] `lib/kinds.ts` defines `ISSUE_KINDS`, `INVENTORY_KINDS`,
          `LISTING_STATUS`, `ORDER_STATUS` with the fa6 icon mapping from
          `SPEC-merchant-portal.md`'s Code Style table.
    - [x] `lib/format.ts` exports the money/number/date/rate formatters the
          views need (the broader cross-view subset: money, number, rate,
          change-pct, date, day-month, plural, cover label, title case, and
          the option/variant helpers Catalog and Inventory both need).
  - **Verification:**
    - [x] `npm run build` — clean (`npx tsc --noEmit` standalone hits the
          same pre-existing, unrelated `tsconfig.json` `baseUrl` deprecation
          error noted in `tasks/todo.md`'s Task 1 — not caused by these
          files; `npm run build`'s TypeScript pass is the real signal and is
          clean).
    - [x] `npm run lint` — clean. Found and fixed one real issue along the
          way: a manual Google-Fonts `<link>` in the merchant root layout
          tripped `@next/next/no-page-custom-font` (the storefront's own
          layout only escapes this rule because its `href` is a dynamic
          template literal the linter can't statically resolve — not a
          real exemption). Switched to `next/font/google`'s `Inter` loader
          instead, which is more correct for a fixed (non-theme-configurable)
          font choice and removes the manual `<link>`/`preconnect` tags
          entirely.
    - [x] Manual: `/merchant` renders with the palette's cool off-white
          background and navy ink text (screenshot-verified), Inter loads
          with no console errors (one unrelated `favicon.ico` 404 — no
          favicon was ever added for `/merchant`, harmless default browser
          request, out of this task's scope).
  - **Dependencies:** Task 1
  - **Files:**
    - `src/styles/merchant.css` (new)
    - `src/layouts/merchant/lib/types.ts` (new)
    - `src/layouts/merchant/lib/kinds.ts` (new)
    - `src/layouts/merchant/lib/format.ts` (new)
    - `src/app/(merchant)/layout.tsx` (edit — imports merchant.css, loads
      Inter via `next/font/google`)
  - **Estimated scope:** Medium (4 new files + 1 edit)

- [x] Task 3: Common primitives
  - **Description:** Build the five presentational primitives every view
    uses, matching the reference's `Panel`/`PageHeader`/`Pill`/`Skeleton`/
    `Notice` prop shapes.
  - **Acceptance criteria:**
    - [x] Each primitive renders using only `merchant.css` tokens (no
          hardcoded colors).
    - [x] Prop shapes match what the views (read during the spec pass) call
          them with — `Panel` ended up needing `icon` and `bodyClassName`
          too (both seen in `HomeView.tsx`'s actual usage), so its final
          shape is `{ title, subtitle?, icon?, action?, bodyClassName?,
          children }`.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean.
    - [x] Temporary smoke render on the `/merchant` placeholder page (all
          5 primitives: a `Panel` with 4 `Pill` tones, a `Skeleton`, a
          `Notice`) — screenshot-verified via Chrome DevTools MCP, correct
          colors per tone (ok=green, warn=amber+dot, danger=red,
          muted=gray), no console errors. Left in place; Task 5 replaces
          this page's content wholesale with the real shell.
  - **Dependencies:** Task 2
  - **Files:**
    - `src/layouts/merchant/ui/Panel.tsx` (new)
    - `src/layouts/merchant/ui/PageHeader.tsx` (new)
    - `src/layouts/merchant/ui/Pill.tsx` (new)
    - `src/layouts/merchant/ui/Skeleton.tsx` (new)
    - `src/layouts/merchant/ui/Notice.tsx` (new)
    - `src/app/(merchant)/merchant/page.tsx` (edit — temporary smoke render)
  - **Estimated scope:** Medium (5 new files + 1 temporary edit)

- [x] Task 4: Fixture data
  - **Description:** Source real Tomosia lighting/décor product data once
    and author the fixture records every view reads.
  - **Acceptance criteria:**
    - [x] `scripts/pull-merchant-fixtures.mjs` fetches ~15 real products
          (a plain `fetch` against the Storefront GraphQL API using the
          same env vars as `src/lib/shopify`, not an import of that
          TypeScript module — it's coupled to `next/headers`/`next/cache`
          and can't load in a bare Node script) and prints JSON; not
          imported by the app. Run once with `node --env-file=.env
          scripts/pull-merchant-fixtures.mjs`.
    - [x] `lib/fixtures/listings.ts` hand-authored from that output — 7
          real listings (real `listing_id`/`title`/`price`/`image_url`,
          Tomosia lighting/décor domain), two of them genuine families
          with real variants/options (Single Pendant: Size; Novelty
          Pendant: Color × Size, whose raw hex color values became the
          `needs_work` content-quality example). Plain-listing ids use the
          product's sole variant id, family listings use the product id —
          the same convention `src/lib/assistant/shapes.ts` already
          documents for this repo's other agent surface.
    - [x] `lib/fixtures/overview.ts`, `alerts.ts`, `orders.ts` hand-authored;
          `overview.ts` derives its alert counts from `alerts.ts` instead
          of restating them, so the two can't drift.
  - **Verification:**
    - [x] `npm run build` — clean (fixtures type-check against
          `lib/types.ts`; standalone `npx tsc --noEmit` still hits the
          pre-existing unrelated `tsconfig.json` `baseUrl` issue noted in
          Task 1/2).
    - [x] `npm run lint` — clean; grepped `src/layouts/merchant/` and
          `src/app/(merchant)/` for `pull-merchant-fixtures` and
          `lib/shopify` — the only hit is a comment, no runtime import.
  - **Dependencies:** Task 2
  - **Files:**
    - `scripts/pull-merchant-fixtures.mjs` (new, throwaway)
    - `src/layouts/merchant/lib/fixtures/listings.ts` (new)
    - `src/layouts/merchant/lib/fixtures/overview.ts` (new)
    - `src/layouts/merchant/lib/fixtures/alerts.ts` (new)
    - `src/layouts/merchant/lib/fixtures/orders.ts` (new)
  - **Estimated scope:** Medium (5 files, one run once and not shipped)

## Checkpoint: Phase 1
- [ ] Types, fixtures, and the 5 common primitives compile with no
      TypeScript errors
- [ ] `npm run lint` clean
- [ ] Fixture data matches the response shapes it will feed
- [ ] Review with human before proceeding

### Phase 2: Shell + Home view

- [x] Task 5: PortalShell + NavRail
  - **Description:** Build the portal chrome — nav rail (four items with
    alert-derived counts), top bar, content area, and a slot for the
    assistant rail — and wire it into `/merchant` with local view-switch
    state.
  - **Acceptance criteria:**
    - [x] Clicking a nav item switches the active view (a placeholder div
          per view is enough at this task).
    - [x] Nav counts (order issues; low stock + slow movers) are computed
          from `lib/fixtures/alerts.ts` (via `OVERVIEW.snapshot.alerts`,
          which itself derives from `alerts.ts` — see Task 4).
    - [x] Layout visually matches the reference's `Shell.tsx` structure
          (nav rail left, content center, rail slot right) at desktop width
          — screenshot- and a11y-snapshot-verified.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean.
    - [x] Manual via Chrome DevTools MCP: all four nav items are clickable
          and switch the visible placeholder (verified Orders); counts
          match fixture data (Orders=3, Inventory=4); the assistant toggle
          switches "Show assistant"/"Hide assistant" (`aria-pressed`) and
          mounts/unmounts the rail placeholder; no console errors.
  - **Dependencies:** Tasks 3, 4
  - **Files:**
    - `src/layouts/merchant/shell/PortalShell.tsx` (new — no separate
      `NavRail.tsx`: the reference itself keeps the nav inline in
      `Shell.tsx` with no second component, and it has exactly one call
      site here too, so splitting it out would be an unused abstraction)
    - `src/app/(merchant)/merchant/page.tsx` (edit — real shell replaces
      the placeholder; per-view content is still a placeholder pending
      Tasks 6-10)
  - **Estimated scope:** Medium (2 files, not 3 — see the `NavRail` note
    above)

- [ ] Task 6: HomeView
  - **Description:** Build the Home view in full: the stat strip, the
    "Needs you today" attention queue with its segmented filter, recent
    orders, and recent changes — set as the default view.
  - **Acceptance criteria:**
    - [ ] Stat tiles render sales/orders/conversion/average-order figures
          from `lib/fixtures/overview.ts`, with change-percent styling.
    - [ ] The attention queue lists order issues and inventory alerts,
          filterable via the segmented control (All/Orders/Low stock/Slow).
    - [ ] Recent orders and recent (staged) changes panels render from
          fixture data.
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual via Chrome DevTools MCP: `/merchant` (default view) matches
          the reference `HomeView.tsx`'s layout and data; filter control
          narrows the queue correctly; no console errors.
  - **Dependencies:** Task 5
  - **Files:**
    - `src/layouts/merchant/views/HomeView.tsx` (new)
    - `src/layouts/merchant/ui/StatTile.tsx` (new)
    - `src/layouts/merchant/ui/StatStrip.tsx` (new)
    - `src/layouts/merchant/ui/AttentionList.tsx` (new)
    - `src/layouts/merchant/ui/AttentionRow.tsx` (new)
    - `src/layouts/merchant/ui/RecordList.tsx` (new)
    - `src/layouts/merchant/ui/Segmented.tsx` (new)
    - `src/layouts/merchant/ui/ApprovalsBanner.tsx` (new)
    - `src/layouts/merchant/ui/QueueOverflow.tsx` (new)
    - `src/layouts/merchant/ui/ViewLink.tsx` (new)
    - `src/layouts/merchant/ui/RecentChanges.tsx` (new)
  - **Estimated scope:** Large (11 files — the widest task in the plan;
    split further mid-task if it stalls, e.g. land the stat strip and
    attention queue first, recent orders/changes as a follow-up commit)

## Checkpoint: Phase 2
- [ ] `/merchant` shows nav rail + Home view fully populated from fixtures
- [ ] Segmented filter works client-side
- [ ] Visual match to the reference's layout and palette
- [ ] Review with human before proceeding

### Phase 3: Remaining views

- [ ] Task 7: InventoryView
  - **Description:** Build the low-stock and slow-mover panels.
  - **Acceptance criteria:**
    - [ ] Low-stock list sorted soonest-to-run-out first; slow-mover list
          shows units tied up.
    - [ ] Each row's mini stock bar and "Draft restock"/"Plan markdown"
          action render correctly (action is inert per the spec — no
          composer send path yet, so it only needs to be visually present).
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: Inventory nav item shows both panels populated from
          `lib/fixtures/alerts.ts`, matching the reference `InventoryView.tsx`.
  - **Dependencies:** Task 6 (reuses `Panel`, `Pill`, `KindIcon` conventions
    established there)
  - **Files:**
    - `src/layouts/merchant/views/InventoryView.tsx` (new)
    - `src/layouts/merchant/ui/MiniBar.tsx` (new)
    - `src/layouts/merchant/ui/AskButton.tsx` (new)
    - `src/layouts/merchant/ui/KindIcon.tsx` (new, if not already added in
      Task 6)
  - **Estimated scope:** Medium (3-4 files)

- [ ] Task 8: OrdersView
  - **Description:** Build the open-issues and recent-orders panels.
  - **Acceptance criteria:**
    - [ ] Open issues list renders with buyer-message excerpts quoted (not
          executed as instructions — rendered as inert text).
    - [ ] Recent orders panel reuses `RecordList` from Task 6.
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: Orders nav item matches the reference `OrdersView.tsx`.
  - **Dependencies:** Task 6 (`AttentionList`, `RecordList`), Task 4
  - **Files:**
    - `src/layouts/merchant/views/OrdersView.tsx` (new)
    - `src/layouts/merchant/ui/QuotedAsData.tsx` (new)
  - **Estimated scope:** Small (2 files)

- [ ] Task 9: CatalogView — listing table
  - **Description:** Build the searchable, filterable listing table (no
    detail sheet yet — that's Task 10).
  - **Acceptance criteria:**
    - [ ] Search box filters by title/id/category/attribute, client-side.
    - [ ] Status `Segmented` filter (All/Active/Low stock/Needs content/
          Inactive) narrows rows, reusing the Task 6 `Segmented` component.
    - [ ] "Needs attention" listings (sold out, low stock, poor content)
          group above the rest, matching the reference's `attentionRank`.
    - [ ] Table shows thumbnail, title/id, category, stock, price, status,
          content-quality cell.
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: Catalog nav item lists all fixture listings; search and
          filter both work; attention grouping matches expectations.
  - **Dependencies:** Task 6 (`Segmented`), Task 4
  - **Files:**
    - `src/layouts/merchant/views/CatalogView.tsx` (new)
    - `src/layouts/merchant/ui/SearchField.tsx` (new)
    - `src/layouts/merchant/ui/Thumb.tsx` (new)
    - `src/layouts/merchant/ui/Button.tsx` (new)
  - **Estimated scope:** Medium (4 files)

- [ ] Task 10: CatalogView — detail sheet + variants
  - **Description:** Add the slide-over listing detail panel (facts, pricing
    band, missing attributes, review snippets, description) and a variants
    table for family listings.
  - **Acceptance criteria:**
    - [ ] Clicking a listing row opens a `Sheet` with the listing's facts,
          pricing context, and (for the fixture's family listing) a variants
          table.
    - [ ] Sheet closes via its close control.
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: open the sheet for both a plain listing and the family
          listing; variants table renders per-variant stock/price/status;
          close works.
  - **Dependencies:** Task 9
  - **Files:**
    - `src/layouts/merchant/views/CatalogView.tsx` (edit)
    - `src/layouts/merchant/ui/Sheet.tsx` (new)
    - `src/layouts/merchant/ui/Facts.tsx` (new, includes `Fact`)
    - `src/layouts/merchant/ui/PriceBand.tsx` (new)
    - `src/layouts/merchant/ui/SectionTitle.tsx` (new)
  - **Estimated scope:** Medium (5 files)

## Checkpoint: Phase 3
- [ ] All four nav items render their view correctly with fixture data
- [ ] Catalog search/filter narrows rows; detail sheet + variants table work
- [ ] `npm run lint` && `npm run build` clean
- [ ] Review with human before proceeding

### Phase 4: Assistant rail, cards, Inspector

- [ ] Task 11: Generative cards
  - **Description:** Build the three card types the assistant rail renders,
    plus the dispatcher that picks one by name.
  - **Acceptance criteria:**
    - [ ] `MetricsCard`, `DigestCard`, `ChangePreviewCard` each render their
          payload type from `lib/types.ts` correctly (spot-checked against
          the reference's fixtures, e.g. the digest/change-preview shapes
          read during the spec pass).
    - [ ] `GenerativeBlock` dispatches on `block.component`.
  - **Verification:**
    - [ ] `npm run lint` — clean.
    - [ ] Temporary smoke render (removed once Task 12 wires the transcript
          for real) confirms each card renders without error against a
          hand-written sample payload.
  - **Dependencies:** Task 4 (types), Task 3 (Panel/Pill)
  - **Files:**
    - `src/layouts/merchant/cards/MetricsCard.tsx` (new)
    - `src/layouts/merchant/cards/DigestCard.tsx` (new)
    - `src/layouts/merchant/cards/ChangePreviewCard.tsx` (new)
    - `src/layouts/merchant/cards/GenerativeBlock.tsx` (new)
  - **Estimated scope:** Medium (4 files)

- [ ] Task 12: Assistant rail (static transcript)
  - **Description:** Author the one sample conversation (referencing real
    fixture listings/changes) and build the rail that displays it.
  - **Acceptance criteria:**
    - [ ] `lib/fixtures/transcript.ts` contains a conversation that surfaces
          all three card types at least once.
    - [ ] `AssistantRail`/`AssistantPanel` render it as a fixed right-side
          panel (desktop only, per the spec — no mobile collapse logic).
    - [ ] The composer's input/send control is visibly present but inert:
          typing and clicking "send" do nothing beyond local input state
          (no message is appended, no error is thrown).
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: rail shows the transcript with all three card types on
          load; typing in the composer and clicking send causes no crash
          and no console error.
  - **Dependencies:** Task 11
  - **Files:**
    - `src/layouts/merchant/lib/fixtures/transcript.ts` (new)
    - `src/layouts/merchant/rail/AssistantRail.tsx` (new)
    - `src/layouts/merchant/rail/AssistantPanel.tsx` (new)
    - `src/layouts/merchant/rail/Composer.tsx` (new)
    - `src/layouts/merchant/rail/MessageBubble.tsx` (new)
    - `src/layouts/merchant/rail/Transcript.tsx` (new)
    - `src/layouts/merchant/shell/PortalShell.tsx` (edit — mount the rail)
  - **Estimated scope:** Large (6 new files + 1 edit; split into
    "Transcript + MessageBubble" and "Composer + AssistantRail/Panel" if it
    stalls)

- [ ] Task 13: Inspector (static trace)
  - **Description:** Add the activity/trace panel and its toggle.
  - **Acceptance criteria:**
    - [ ] `lib/fixtures/trace.ts` contains paired call/result rows matching
          the sample transcript's tool activity.
    - [ ] Inspector opens via a toggle in the shell, shows the trace rows,
          closes via its own control.
  - **Verification:**
    - [ ] `npm run build` && `npm run lint` — clean.
    - [ ] Manual: toggle opens/closes the Inspector; rows match the
          transcript's implied tool calls.
  - **Dependencies:** Task 12
  - **Files:**
    - `src/layouts/merchant/lib/fixtures/trace.ts` (new)
    - `src/layouts/merchant/inspector/Inspector.tsx` (new)
    - `src/layouts/merchant/shell/PortalShell.tsx` (edit — activity toggle)
  - **Estimated scope:** Small (2 new files + 1 edit)

## Checkpoint: Phase 4
- [ ] Assistant rail shows the sample transcript with all 3 card types
- [ ] Inspector opens/closes with static trace rows
- [ ] Nav-rail badge counts still match fixture alert counts
- [ ] Review with human before the final polish pass

### Phase 5: Polish & verification

- [ ] Task 14: Full manual test pass + final lint/build
  - **Description:** Run every step in `SPEC-merchant-portal.md`'s Testing
    Strategy end to end and close out anything it surfaces.
  - **Acceptance criteria:**
    - [ ] All 10 steps in `SPEC-merchant-portal.md`'s Testing Strategy pass.
    - [ ] No storefront route regressed from the Task 1 route split.
    - [ ] `scripts/pull-merchant-fixtures.mjs` is confirmed unreachable from
          any runtime import path.
  - **Verification:**
    - [ ] `npm run lint` — clean.
    - [ ] `npm run build` — clean.
    - [ ] Manual walkthrough of all 10 Testing Strategy steps via Chrome
          DevTools MCP, at a common laptop and a common desktop width.
  - **Dependencies:** Tasks 1–13
  - **Files:** Whatever the walkthrough surfaces as needing a fix; no new
    files expected.
  - **Estimated scope:** Medium (verification-heavy, fixes as needed)

## Checkpoint: Complete
- [ ] All `SPEC-merchant-portal.md` success criteria met
- [ ] `npm run lint` && `npm run build` clean
- [ ] No file outside `src/app/(merchant)/**`, `src/app/(storefront)/**`
      (moved, unchanged), `src/layouts/merchant/**`, `src/styles/merchant.css`,
      and `scripts/pull-merchant-fixtures.mjs` was modified
- [ ] No new npm dependency was added
- [ ] Ready for human review / commit
