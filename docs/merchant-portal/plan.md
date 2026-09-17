# Implementation Plan: Merchant Portal UI Shell

See `spec.md` for the full spec (objective, tech stack,
project structure, code style, boundaries) and `todo.md`
for the detailed task checklist. This document covers the plan's rationale
and cross-cutting decisions only.

## Overview

Build a UI-only `/merchant` route mirroring
`commerce-agents/examples/retail/merchant-web`: its own root layout, its own
ACME-derived palette, four views (Home/Catalog/Orders/Inventory), a static
assistant rail with three generative card types, and a static Inspector
panel — all on fixture data, no backend. All design decisions were resolved
in a prior `/grill-me` interview and written up in `spec.md`;
this plan turns that spec into an ordered, verifiable task list.

Deliverables of this planning pass use this repo's existing feature-suffixed
convention (`spec.md` already does): `plan.md`
(this file) and `todo.md`. The existing `../shopping-assistant-ui-mock/plan.md`
/ `../shopping-assistant-ui-mock/todo.md` (the completed Shopping Assistant Modal work) are untouched.

## Architecture Decisions

- **Routing split first, as its own task.** Moving `src/app/**` into
  `(storefront)/` and adding an independent `(merchant)/` root layout is the
  one genuinely risky, all-or-nothing step (the `not-found.tsx` /
  multi-root-layout edge case flagged in the spec). It goes first so any
  Next.js surprise is found before any UI code exists to rework.
- **Vertical slicing by view, not by primitive library.** Rather than
  building all ~20 small presentational primitives (`Panel`, `Pill`,
  `StatTile`, `Sheet`, etc.) as one upfront library, only the primitives
  genuinely shared by every view (`Panel`, `PageHeader`, `Pill`, `Skeleton`,
  `Notice`) are built up front; every other primitive is added in the task
  for the one view that first needs it, then reused. This follows the
  reference's own component boundaries (confirmed by reading `HomeView.tsx`,
  `CatalogView.tsx`, `InventoryView.tsx`, `OrdersView.tsx` directly) instead
  of guessing at a library shape ahead of time.
- **Home view built first** — it exercises the most shared primitives
  (`StatTile`, `StatStrip`, `AttentionList/Row`, `Segmented`, `RecordList`),
  so building it first front-loads the primitives every other view reuses.
- **Catalog view split into two tasks** (listing table + search, then the
  detail `Sheet` + variants table) because the reference's `CatalogView.tsx`
  is the single largest view (441 lines, a table, a slide-over detail panel,
  and a nested variants table) — one task would exceed the ~5-file guideline.
- **Assistant rail, cards, and Inspector come after all four views**, since
  per the interview they're static/fixture-driven and don't gate view work,
  and the sample transcript's cards are easiest to author once the fixture
  data they reference (from the views' fixtures) already exists.
- **Fixture data sourcing is one task, done once**, using
  `src/lib/shopify`'s existing `getProducts` (`src/lib/shopify/index.ts:651`)
  in a throwaway script — never imported by any page.

## Task List

### Phase 0: Routing foundation
- [ ] Task 1: Route split + placeholder `/merchant` page

### Checkpoint: Phase 0

### Phase 1: Shared foundation
- [ ] Task 2: Palette + data types + formatters
- [ ] Task 3: Common primitives (Panel, PageHeader, Pill, Skeleton, Notice)
- [ ] Task 4: Fixture data (real product pull + hand-authored records)

### Checkpoint: Phase 1

### Phase 2: Shell + Home view
- [ ] Task 5: PortalShell + NavRail
- [ ] Task 6: HomeView

### Checkpoint: Phase 2

### Phase 3: Remaining views
- [ ] Task 7: InventoryView
- [ ] Task 8: OrdersView
- [ ] Task 9: CatalogView — listing table
- [ ] Task 10: CatalogView — detail sheet + variants

### Checkpoint: Phase 3

### Phase 4: Assistant rail, cards, Inspector
- [ ] Task 11: Generative cards
- [ ] Task 12: Assistant rail (static transcript)
- [ ] Task 13: Inspector (static trace)

### Checkpoint: Phase 4

### Phase 5: Polish & verification
- [ ] Task 14: Full manual test pass + final lint/build

### Checkpoint: Complete

See `todo.md` for each task's description, acceptance
criteria, verification steps, dependencies, and files.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `not-found.tsx` under two root layouts is a documented Next.js edge case | Medium — could block the routing split | Task 1 resolves it first, before any other code exists; fall back to a `not-found.tsx` duplicated per group if a single shared one doesn't resolve |
| CatalogView is large or scope-creeps | Medium | Already split into two tasks (list vs. detail sheet); split further at that time if either still exceeds ~5 files in practice |
| Fixture data drifts from real product shapes (options/variants) | Low | The one-off pull script fetches real product option/variant shapes too, not just title/price, so at least one Catalog fixture listing is a genuine family (multiple variants) |

## Open Questions

None outstanding — `spec.md`'s own open items (exact fixture
copy, the `not-found.tsx` resolution) are addressed by Task 1 (routing) and
Tasks 4/12/13 (copy, drafted during implementation as the spec anticipated).
