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

- [x] Task 6: HomeView
  - **Description:** Build the Home view in full: the stat strip, the
    "Needs you today" attention queue with its segmented filter, recent
    orders, and recent changes — set as the default view.
  - **Acceptance criteria:**
    - [x] Stat tiles render sales/orders/conversion/average-order figures
          from `lib/fixtures/overview.ts`, with change-percent styling and
          sparklines (current vs. prior period).
    - [x] The attention queue lists order issues and inventory alerts,
          filterable via the segmented control (All/Orders/Low stock/Slow).
    - [x] Recent orders and recent (staged) changes panels render from
          fixture data.
  - **Retroactive fix (root-cause, not scope creep):** while reading
    `web-shared/ui.tsx` for the primitives this task needed, found that
    Task 3's `Panel`/`PageHeader`/`Pill`/`Notice`/`Skeleton` were built from
    view *usage* patterns without the authoritative primitive source, and
    drifted from it (`Panel` had a default body padding the reference
    doesn't, forcing double-padding once real children with their own
    padding were added; `PageHeader` was sized/laid out differently;
    `Pill`'s padding/dot markup differed; `Notice`'s background/size
    differed). Corrected all five to match `ui.tsx` exactly now, rather
    than carrying the drift into every later task that composes them.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean, first pass.
    - [x] Manual via Chrome DevTools MCP: `/merchant` (default view) matches
          the reference `HomeView.tsx`'s layout and data — screenshot- and
          a11y-snapshot-verified stat tiles/sparklines/approvals banner/
          attention queue/insights/recent orders/recent changes; clicked a
          `StatTile` ("Sales: ask the assistant why") and confirmed the
          exact `askWhy()` prefill text appears in the (still placeholder)
          assistant rail; clicked the "Orders" segmented option and
          confirmed the queue narrows to the 3 order issues; no console
          errors throughout.
  - **Dependencies:** Task 5
  - **Files:**
    - `src/layouts/merchant/views/HomeView.tsx` (new)
    - `src/layouts/merchant/ui/StatTile.tsx` (new — includes `Sparkline`
      and `ChangeChip` inline; each has exactly one consumer here, so they
      aren't separate exported primitives)
    - `src/layouts/merchant/ui/StatStrip.tsx` (new)
    - `src/layouts/merchant/ui/AttentionList.tsx` (new)
    - `src/layouts/merchant/ui/AttentionRow.tsx` (new)
    - `src/layouts/merchant/ui/RecordList.tsx` (new)
    - `src/layouts/merchant/ui/Segmented.tsx` (new)
    - `src/layouts/merchant/ui/ApprovalsBanner.tsx` (new)
    - `src/layouts/merchant/ui/QueueOverflow.tsx` (new)
    - `src/layouts/merchant/ui/ViewLink.tsx` (new)
    - `src/layouts/merchant/ui/RecentChanges.tsx` (new)
    - `src/layouts/merchant/ui/KindIcon.tsx` (new — needed by
      `AttentionRow`/`ApprovalsBanner`/`Insights`, not called out
      separately in the plan but part of the same reference primitive set)
    - `src/layouts/merchant/ui/AskButton.tsx` (new — same reason)
    - `src/layouts/merchant/ui/Button.tsx` (new — same reason, needed by
      `ApprovalsBanner`)
    - `src/layouts/merchant/ui/Panel.tsx`, `PageHeader.tsx`, `Pill.tsx`,
      `Notice.tsx`, `Skeleton.tsx` (edit — retroactive fix, see above)
    - `src/layouts/merchant/lib/format.ts` (edit — added `greeting`,
      `formatPeriodLabel`, `formatComparisonLabel`, `describeProposer`,
      `describeResolver`, `orderRows`)
    - `src/layouts/merchant/lib/kinds.ts` (edit — added `CHANGE_STATUS`)
    - `src/app/(merchant)/merchant/page.tsx` (edit — wires `HomeView` as
      the default view; `onAskAssistant` opens the rail and shows the
      prefill text, since the real composer doesn't exist until Task 12)
  - **Estimated scope:** Large (11 new primitives + 1 view + 3 fixture-era
    files edited + 5 earlier primitives corrected — wider than planned
    once the `ui.tsx` source was read in full, but no file was individually
    large)

## Checkpoint: Phase 2
- [x] `/merchant` shows nav rail + Home view fully populated from fixtures
- [x] Segmented filter works client-side
- [x] Visual match to the reference's layout and palette
- [ ] Review with human before proceeding

### Phase 3: Remaining views

- [x] Task 7: InventoryView
  - **Description:** Build the low-stock and slow-mover panels.
  - **Acceptance criteria:**
    - [x] Low-stock list sorted soonest-to-run-out first; slow-mover list
          shows units tied up.
    - [x] Each row's mini stock bar and "Draft restock"/"Plan markdown"
          action render correctly (action is inert per the spec — no
          composer send path yet, so it only needs to be visually present;
          wired to the same `onAskAssistant` prefill-and-open path Home
          uses, so it's not a dead click either).
  - **Bug found and fixed:** the real Shopify gids used as `listing_id`
    (e.g. `gid://shopify/ProductVariant/47643685519522`, vs. the
    reference's short mnemonic ids like `AR-2102`) have no natural wrap
    point; against this view's fixed-width `w-32` stock column (unlike
    Home's full-width attention rows, which never hit this), the id text
    overflowed its box and visually overlapped the stock figure. Fixed
    with `break-all` on the id span — likely to recur in Orders/Catalog,
    watch for it there.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean.
    - [x] Manual via Chrome DevTools MCP: Inventory nav item shows both
          panels populated from `lib/fixtures/alerts.ts` (3 low-stock rows
          sorted by days of cover, 1 slow mover), matching the reference
          `InventoryView.tsx`; screenshot confirmed the gid-overlap fix; no
          console errors.
  - **Dependencies:** Task 6 (reuses `Panel`, `Pill`, `KindIcon`, `AskButton`)
  - **Files:**
    - `src/layouts/merchant/views/InventoryView.tsx` (new)
    - `src/layouts/merchant/ui/MiniBar.tsx` (new)
    - `src/app/(merchant)/merchant/page.tsx` (edit — wires `InventoryView`)
  - **Estimated scope:** Small (2 new files + 1 edit — `AskButton`/`KindIcon`
    already existed from Task 6)

- [x] Task 8: OrdersView
  - **Description:** Build the open-issues and recent-orders panels.
  - **Acceptance criteria:**
    - [x] Open issues list renders with buyer-message excerpts quoted (not
          executed as instructions — rendered as inert text, labeled
          "shown as written" via `QuotedAsData`).
    - [x] Recent orders panel reuses `RecordList` from Task 6.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean.
    - [x] Manual via Chrome DevTools MCP: Orders nav item matches the
          reference `OrdersView.tsx` — 3 open issues (including the quoted
          buyer message), 6 recent orders with correctly toned status
          pills (return_initiated → violet "Return requested", etc.); the
          long-gid overlap bug from Task 7 does not recur here (`AttentionRow`'s
          full-width layout, not a fixed-width sibling column); no console
          errors.
  - **Dependencies:** Task 6 (`AttentionList`, `RecordList`), Task 4
  - **Files:**
    - `src/layouts/merchant/views/OrdersView.tsx` (new)
    - `src/layouts/merchant/ui/QuotedAsData.tsx` (new)
    - `src/app/(merchant)/merchant/page.tsx` (edit — wires `OrdersView`)
  - **Estimated scope:** Small (2 new files + 1 edit)

- [x] Task 9: CatalogView — listing table
  - **Description:** Build the searchable, filterable listing table (no
    detail sheet yet — that's Task 10).
  - **Acceptance criteria:**
    - [x] Search box filters by title/id/category/attribute, client-side.
    - [x] Status `Segmented` filter (All/Active/Low stock/Needs content/
          Inactive) narrows rows, reusing the Task 6 `Segmented` component.
    - [x] "Needs attention" listings (sold out, low stock, poor content)
          group above the rest, matching the reference's `attentionRank`.
    - [x] Table shows thumbnail, title/id, category, stock, price, status,
          content-quality cell.
  - **Note:** skipped `formatCategoryLabel` from the reference — our
    fixture's `category` values are already display-ready strings
    ("Pendant Lights"), not slugs, so no translation layer is needed.
    Preemptively added `break-all` to the listing-id cell, having just hit
    that exact overflow bug in Task 7.
  - **Bug found and fixed:** Chrome DevTools flagged the ported
    `SearchField`'s `<input>` (missing a `name` attribute) as a real
    accessibility issue — same class of gap the sibling Shopping Assistant
    Modal feature already caught and fixed once. Added `name="catalog-search"`.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean.
    - [x] Manual via Chrome DevTools MCP: Catalog nav item lists all 7
          fixture listings with real Shopify CDN thumbnails; typing
          "pendant" in search narrows to the 4 pendant listings; segmented
          filter counts match (Active 5, Low stock 3, Needs content 2,
          Inactive 2 — the last includes both out-of-stock listings, not
          just paused/draft, matching the reference's own semantics);
          attention grouping correct (both out-of-stock listings first,
          then low-stock, then the two content-quality issues); no console
          errors after the `name` fix.
  - **Dependencies:** Task 6 (`Segmented`, `Button`), Task 4
  - **Files:**
    - `src/layouts/merchant/views/CatalogView.tsx` (new)
    - `src/layouts/merchant/ui/SearchField.tsx` (new)
    - `src/layouts/merchant/ui/Thumb.tsx` (new)
    - `src/app/(merchant)/merchant/page.tsx` (edit — wires `CatalogView`;
      dropped the now-fully-unused `ViewPlaceholder` helper)
  - **Estimated scope:** Medium (3 new files + 1 edit — `Button` already
    existed from Task 6)

- [x] Task 10: CatalogView — detail sheet + variants
  - **Description:** Add the slide-over listing detail panel (facts, pricing
    band, missing attributes, review snippets, description) and a variants
    table for family listings.
  - **Acceptance criteria:**
    - [x] Clicking a listing row opens a `Sheet` with the listing's facts,
          pricing context, and (for the fixture's 2 family listings) a
          variants table.
    - [x] Sheet closes via its close control (and via Escape).
  - **Scope grown beyond the plan (needed for the pricing section to mean
    anything):** added `lib/fixtures/pricing.ts`, a `Record<listing_id,
    PricingContext>` for the 5 plain listings (skipped for the 2 families,
    matching the reference's own `!hasOptions(listing)` gate) — one entry
    (Light Drum Pendant) deliberately mirrors the applied price change
    already in `overview.ts`'s `recent_changes` ($2,899 → $2,567). Also
    added `review_snippets` to one listing (Cotton Novelty Pendant) so the
    "What buyers say" section has something real to render. `openListing`
    state moved from the page into `CatalogView` itself (self-contained,
    matching the reference — the placeholder wiring from Task 9 lived in
    the page only because the sheet didn't exist yet).
  - **Bug found and fixed:** the ported `Sheet` (client-only mount + SSR
    guard via `useState`/`useEffect`) tripped `react-hooks/set-state-in-effect`
    — a real lint error, not a false positive. Since this view only ever
    mounts a `Sheet` from a post-mount click (never part of the initial
    render), reading `document.body` directly at render time removes the
    need for the state/effect pair entirely — simpler code, not a workaround.
  - **Verification:**
    - [x] `npm run build` && `npm run lint` — clean (after the `Sheet` fix).
    - [x] Manual via Chrome DevTools MCP: opened the sheet for a family
          listing (Single Pendant — variants table with one sold-out
          variant, no pricing section since it has options), a listing with
          missing attributes and no pricing-friendly description (Light
          Drum Pendant — PriceBand renders correctly, "Missing from the
          listing" pills present, footer has no restock button since its
          alert is `slow_mover` not `low_stock`), and a listing with
          reviews + a restock button (Cotton Novelty Pendant); clicked
          "Draft restock" and confirmed it closed the sheet and opened the
          assistant rail with the exact expected prefill text; Escape
          closes the sheet; no console errors.
  - **Dependencies:** Task 9
  - **Files:**
    - `src/layouts/merchant/views/CatalogView.tsx` (edit — `ListingSheet`,
      `VariantsTable`, internal `openListing` state)
    - `src/layouts/merchant/ui/Sheet.tsx` (new)
    - `src/layouts/merchant/ui/Facts.tsx` (new, includes `Fact`)
    - `src/layouts/merchant/ui/PriceBand.tsx` (new)
    - `src/layouts/merchant/ui/SectionTitle.tsx` (new)
    - `src/layouts/merchant/lib/fixtures/pricing.ts` (new)
    - `src/layouts/merchant/lib/fixtures/listings.ts` (edit — added
      `review_snippets` to one listing)
    - `src/app/(merchant)/merchant/page.tsx` (edit — drops the
      page-level `openListing` state/prop, passes `pricing`)
  - **Estimated scope:** Medium-large (5 new files + 3 edits — grew past
    the plan's 5-file estimate once the pricing section needed real data
    to render)

## Checkpoint: Phase 3
- [x] All four nav items render their view correctly with fixture data
- [x] Catalog search/filter narrows rows; detail sheet + variants table work
- [x] `npm run lint` && `npm run build` clean
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
