# Spec: Merchant Portal UI Shell

## Objective

Add a `/merchant` route that visually and structurally mirrors
`commerce-agents/examples/retail/merchant-web` — a portal chrome (left nav
rail + persistent right assistant rail), four views (Home, Catalog, Orders,
Inventory), the three generative cards (Metrics, Digest, Change Preview), and
an Inspector activity panel — entirely on **static fixture data**.

This is a **UI-only** deliverable, same spirit as the existing Shopping
Assistant Modal spec (`SPEC.md`): no merchant-agent backend, no Shopify Admin
API wiring, no live chat. It exists to preview/evaluate the portal design
direction before any of that backend work is scoped. It does **not** itself
reverse the "Role: shopping agent only. No merchant agent." decision recorded
in `CLAUDE.md` — that remains a separate, future decision if this direction is
approved.

**User:** an internal reviewer (Tomosia team) evaluating the UI — not a
signed-in store operator. No auth, no gate, no link from the storefront (per
interview: direct-URL access only).

**Success looks like:** visiting `/merchant` renders a portal chrome distinct
from the storefront (its own nav rail, its own ACME-derived color palette —
no Header/Footer/cart) with all four views populated by realistic-looking
Tomosia lighting/décor fixture data; the assistant rail shows a static,
pre-scripted transcript that demonstrates all three generative card types;
the Inspector panel opens and shows a static trace; nothing on the page calls
a real API (Storefront, Admin, or agent) at runtime.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript — existing.
- Tailwind CSS v4 — existing. A new scoped stylesheet
  (`src/styles/merchant.css`) carries the portal's own CSS custom-property
  palette; `src/config/theme.json` / `generated-theme.css` (the storefront's
  brand tokens) are untouched.
- `react-icons` (already a dependency) via the existing `DynamicIcon` helper
  (`src/layouts/helpers/DynamicIcon.tsx`) — no new icon package.
- No new npm dependency of any kind.

## Commands

Same as the rest of the repo (see `README.md` / `SPEC.md`):

- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Format: `npm run format`
- No test runner is configured; verification is manual (below).

## Project Structure

**Routing — two root layouts via route groups.** `src/app/layout.tsx` today
is the site's single root layout (owns `<html>/<body>`, hard-codes
`Header`/`Footer`/`Providers`/`AssistantButton`) and Next.js applies it to
every route. Per interview, the merchant portal gets a fully independent root
layout instead of a pathname-based conditional, which means moving the
existing routes into their own group:

```
src/app/(storefront)/           ← existing routes, moved as-is (git mv; no
                                    content changes to any of them)
  layout.tsx                     (today's src/app/layout.tsx, unchanged)
  page.tsx
  not-found.tsx
  [regular]/page.tsx
  about/page.tsx
  contact/page.tsx
  products/page.tsx
  products/[slug]/page.tsx
  (auth)/login/page.tsx
  (auth)/sign-up/page.tsx

src/app/(merchant)/
  layout.tsx                     ← merchant's own root layout: own <html>/
                                    <body>, imports src/styles/merchant.css,
                                    reuses the same Inter Google Font <link>
                                    as the storefront (per interview — no new
                                    font load), no Header/Footer/Providers/
                                    Cart/AssistantButton
  merchant/page.tsx               ← the portal page: owns active-view state,
                                    mounts PortalShell + AssistantRail + the
                                    active view

src/app/api/**                   ← untouched. Route Handlers don't render a
                                    layout, so they aren't affected by the
                                    root-layout split.
```

**Risk flagged for the Plan phase:** a top-level `not-found.tsx` under
multiple root layouts is a known Next.js edge case (the documented pattern is
"Opting specific segments out of a shared layout") — confirm the exact
placement works with `npm run build` before considering routing done; it is
not a blocker to writing this spec.

**New component tree**, self-contained per interview (own folder, not mixed
into `components/`/`partials/`):

```
src/layouts/merchant/
  shell/
    PortalShell.tsx       → nav rail + top bar + content area + rail slot
    NavRail.tsx            → Home/Catalog/Orders/Inventory items w/ counts
  rail/
    AssistantRail.tsx      → fixed right-side panel (desktop only, per
                              interview — no collapsible/mobile-bar logic)
    AssistantPanel.tsx     → static transcript + starter chips + composer
    Composer.tsx           → text input + send button, inert (no send path)
    MessageBubble.tsx
    Transcript.tsx
  cards/
    MetricsCard.tsx
    DigestCard.tsx
    ChangePreviewCard.tsx
    GenerativeBlock.tsx     → dispatches on a block's component name, mirrors
                              the reference's generative/index.tsx
  inspector/
    Inspector.tsx           → activity/trace panel, static fixture rows
  ui/                       → local reimplementation of only the web-shared
                              primitives the four views actually use:
    Panel.tsx, PageHeader.tsx, Pill.tsx, StatTile.tsx, StatStrip.tsx,
    AttentionList.tsx, AttentionRow.tsx, RecordList.tsx, Segmented.tsx,
    SearchField.tsx, Sheet.tsx, Skeleton.tsx, Notice.tsx, Button.tsx,
    AskButton.tsx, KindIcon.tsx, MiniBar.tsx, QuotedAsData.tsx, Thumb.tsx
  views/
    HomeView.tsx, CatalogView.tsx, OrdersView.tsx, InventoryView.tsx
  lib/
    types.ts    → port of the reference's lib/types.ts (Listing, StagedChange,
                  OverviewResponse, InventoryAlert, OrderIssue, etc.)
    kinds.ts    → port of lib/kinds.ts (ISSUE_KINDS, INVENTORY_KINDS,
                  LISTING_STATUS, ORDER_STATUS), icon values remapped to
                  react-icons/fa6 names (see Code Style)
    format.ts   → money/number/date formatting helpers the views use
    fixtures/
      overview.ts, listings.ts, alerts.ts, orders.ts, transcript.ts, trace.ts
        → static Tomosia lighting/décor data. listing_id/title/price/image
          values are seeded from a one-time real Storefront API pull (see
          below), then hand-edited into these files.

src/styles/merchant.css   → the reference's ACME token palette (--ink,
                             --accent, --brand, --ok/--warn/--danger/--info/
                             --violet, --radius, --shadow*, etc., values
                             copied verbatim from merchant-web's globals.css)
                             plus the structural rules from its portal.css,
                             scoped so it never leaks into (storefront) routes.

scripts/pull-merchant-fixtures.mjs   → one-off script, never imported by the
   app or run at dev/build time. Reuses src/lib/shopify's existing read-only
   Storefront client to fetch ~6-10 real Tomosia lighting/décor products
   (id, title, price, image) once and print JSON, to hand-copy into
   lib/fixtures/listings.ts. Deleted or left inert after use.
```

## Code Style

- Mirror the reference's component boundaries, names, and prop shapes closely
  (so a future real port — real data, real chat — is a near-drop-in), but
  flatten "web-shared as an npm package" into plain relative imports inside
  `src/layouts/merchant/`.
- `"use client"` at the top of every interactive file, matching this repo's
  existing convention.
- Tailwind utility classes reading the `merchant.css` custom properties via
  arbitrary-value syntax (`bg-(--card)`, `text-(--ink)`, `border-(--line)`),
  the same syntax this repo already uses for its generated theme tokens —
  no hand-ordering (Prettier + `prettier-plugin-tailwindcss` still applies).
- Icons: `<DynamicIcon icon="..." />` from `@/helpers/DynamicIcon`
  (`react-icons/fa6` under the hood), mapped once in `lib/kinds.ts` in place
  of the reference's own hand-drawn icon keys:

  | Reference key | fa6 icon |
  |---|---|
  | `home` | `FaHouse` |
  | `tag` | `FaTag` |
  | `inbox` | `FaInbox` |
  | `box` | `FaBox` |
  | `truck` | `FaTruck` |
  | `return` | `FaRotateLeft` |
  | `message` | `FaCommentDots` |
  | `alert` | `FaTriangleExclamation` |
  | `low` | `FaBoxOpen` |
  | `clock` | `FaClock` |
  | `spark` | `FaWandMagicSparkles` |
  | `arrow-right` | `FaArrowRight` |

- No new npm dependency; no import from `src/lib/shopify/**` in any file that
  ships to the browser — the one-off pull script is the only thing that
  touches it, and it is not part of the app bundle.

Example (the `Panel` primitive — token usage and the prop shape mirrored from
the reference, one of ~18 small primitives under `ui/`):

```tsx
"use client";

export default function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--radius) border border-(--line) bg-(--card) shadow-(--shadow-sm)">
      <header className="flex items-center justify-between gap-3 px-[18px] pt-4">
        <div>
          <h2 className="text-[15px] font-semibold text-(--ink)">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-(--ink-soft)">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="pb-4 pt-2">{children}</div>
    </section>
  );
}
```

## Behavior Spec (resolved via the `grill-me` interview)

1. **Scope:** UI shell only — mock/fixture data throughout, no merchant-agent,
   no Shopify Admin API, no live chat backend.
2. **Location:** a new route in this same Next.js app, not a separate app/port.
3. **Layout:** fully separate root layout (route groups, see Project
   Structure) — no storefront Header/Footer/cart chrome. No auth gate.
4. **Palette:** the reference's ACME token palette copied verbatim into
   `src/styles/merchant.css`, not derived from `theme.json`.
5. **Chat:** fully static display, no interaction — composer and transcript
   render one pre-authored sample conversation (à la the reference's
   `/showcase` page), demonstrating all three card types. No send path.
6. **Views:** all four (Home, Catalog, Orders, Inventory), matching the
   reference's nav rail.
7. **Fixture content:** rewritten for Tomosia's lighting/home-décor domain
   (per `CLAUDE.md`'s `domain_search_notes`), not the reference's ACME copy.
8. **Fixture sourcing:** listing id/title/price/image pulled once from the
   live Storefront API via a throwaway script, then hardcoded — no live call
   at runtime (same practice as the shopping-agent evals fixtures).
9. **Code organization:** one self-contained folder, `src/layouts/merchant/`,
   not mixed into the storefront's `components/`/`partials/`.
10. **Inspector:** included, with static fixture trace rows matching the
    sample transcript.
11. **Responsive:** desktop-first; no port of the reference's mobile nav bar
    or collapsible-rail animation logic — just no broken layout on narrow
    viewports.
12. **Font:** reuse the site's existing Inter load; no separate Instrument
    Sans import for `/merchant`.
13. **Icons:** reuse `DynamicIcon` + `react-icons/fa6` (table above), not the
    reference's hand-drawn SVG icon set.
14. **Discoverability:** no link from the storefront (footer or otherwise) —
    direct URL only.

## Testing Strategy

No test runner is configured. Verification is manual:

1. `npm run dev`, open `/merchant` — portal chrome renders with its own nav
   rail and palette; no storefront Header/Footer/cart icon anywhere on the
   page (view source / DOM check).
2. Every storefront route (`/`, a product page, `/about`, `/contact`,
   `/login`) still renders normally with Header/Footer intact — the route
   group move didn't change any storefront behavior.
3. Click each of the four nav items (Home, Catalog, Orders, Inventory) — each
   view renders its fixture data (stat tiles, listing table, order/issue
   lists, inventory alert lists) with no console errors.
4. Catalog view: search box and status filter (`Segmented`) narrow the fixture
   listing rows client-side; clicking a row opens the listing detail `Sheet`
   with fixture pricing/variant data.
5. Assistant rail: the pre-authored transcript renders on load, showing at
   least one `MetricsCard`, one `DigestCard`, and one `ChangePreviewCard`;
   the composer's input/send control is visibly present but does nothing
   destructive when interacted with (no error, no crash).
6. Click the Inspector/activity toggle — panel opens showing static
   call/result trace rows; closes via its close control.
7. Nav-rail badge counts (order issues, low stock + slow movers) match the
   counts actually present in the fixture data.
8. Resize to a common laptop and a common desktop width — no horizontal
   overflow, no obviously broken layout (mobile polish is out of scope per
   interview item 11).
9. `npm run lint` — clean, including `react-hooks/exhaustive-deps`.
10. `npm run build` — clean (Turbopack compile, TypeScript, static
    generation, including both root layouts resolving correctly).

## Boundaries

- **Always do:** keep this entirely additive and fixture-driven; keep
  `(storefront)`'s moved routes byte-identical (a `git mv`, not a rewrite);
  keep `react-hooks/exhaustive-deps` clean; keep the merchant palette scoped
  to `merchant.css` only; keep the one-off fixture-pull script out of the
  runtime bundle.
- **Ask first:** any new npm dependency; wiring any part of this to a real
  API (Storefront, Admin, or a merchant-agent) once it exists; adding a
  storefront-side link to `/merchant`; adding an auth gate.
- **Never do:** call `src/lib/shopify/**` from any file that ships to the
  browser; touch `src/app/api/**`, `cartActions.ts`, or the customer auth
  cookie logic; change `theme.json` / `generated-theme.css`; make the
  assistant rail imply it is live/interactive when it is a static transcript;
  reverse or edit the "no merchant agent" decision record in `CLAUDE.md` (a
  separate future decision, out of this spec's scope).

## Success Criteria

- All 10 steps in Testing Strategy pass manually.
- `npm run lint` and `npm run build` succeed with no new errors/warnings.
- No file under `src/app/(storefront)/**` differs from today's
  `src/app/**` (equivalent) content except its path.
- No file outside `src/app/(merchant)/**`, `src/layouts/merchant/**`,
  `src/styles/merchant.css`, and `scripts/pull-merchant-fixtures.mjs` is
  modified.
- No new npm dependency added.

## Open Questions

- Exact copy for the fixture data (product names, the sample transcript's
  wording, trace rows) is drafted during implementation — no specific copy
  was dictated beyond "Tomosia lighting/décor domain."
- The `not-found.tsx` placement under two root layouts (flagged above) needs
  a concrete resolution at Plan time; not expected to change this spec's
  scope, only its exact file location.
