# Implementation Plan: Shopping Assistant Modal (UI-only)

## Overview

`spec.md` calls for a UI-only "Shopping Assistant" chat experience: a floating
action button (FAB) that opens a centered modal dialog, with a scripted
(non-AI) conversation — starter prompts, typewriter-streamed replies, a
loading shimmer, and fixture product cards with a local-only "Add to cart"
toggle. This plan breaks that spec into an ordered, vertically-sliced task
list. See `spec.md` for full behavior/boundaries detail.

Exploration findings that shape the approach:
- No existing modal/dialog/focus-trap pattern in this repo (`CartModal.tsx` is
  a slide-in panel styled with CSS transforms/visibility, not an ARIA dialog).
- No native `<dialog>` usage anywhere yet.
- `Providers.tsx` only wraps `next-themes`; there's no existing global client
  context to hook into or conflict with.
- Icon convention: plain `react-icons` component, sized via `className`
  (Tailwind classes) passed down from the parent, no `size` prop, no built-in
  aria attributes on the icon itself — the interactive parent element carries
  aria. `CloseCart.tsx` uses `FaXmark` from `react-icons/fa6`; `OpenCart.tsx`
  uses `BsCart3` from `react-icons/bs`. No `hi2` precedent exists.
- `tsconfig.json` confirms `@/components/*` → `src/layouts/components/*`.

## Architecture Decisions

1. **Use the native `<dialog>` element for `AssistantModal`, not a hand-rolled
   focus trap.** `showModal()`/`close()` give Escape-to-close, a real focus
   trap, and implicit `role="dialog"`/modal semantics for free — this
   satisfies the spec's accessibility requirements with far less code than
   reimplementing them, and there's no existing in-repo pattern we'd be
   diverging from. Centering/backdrop styling via Tailwind's `backdrop:`
   variant (targets `::backdrop`) plus a CSS reset (`p-0 border-none` on the
   `<dialog>`, layout classes on an inner wrapper div). Backdrop-click-to-close
   is the one bit of manual JS needed: a click handler on the `<dialog>` that
   closes only when `event.target === dialogRef.current`.

2. **`AssistantChat` mounts once and stays mounted; visibility is controlled
   imperatively, not by conditional rendering.** `AssistantButton` renders
   `<AssistantModal>` (containing `<AssistantChat>`) unconditionally; opening
   is `dialogRef.current.showModal()`, closing is `.close()`. This means
   conversation state (and each `ProductCard`'s local "added" toggle) can live
   as ordinary `useState`/`useReducer` inside `AssistantChat` itself — no need
   to lift state up to `AssistantButton` or introduce a context. It falls out
   naturally that state persists across close/reopen and client-side
   navigation (React tree never unmounts) and resets on full reload (new page
   load = new React tree). This is a simplification over the SPEC's literal
   wording ("state lives in AssistantButton's subtree") — same observable
   behavior, less machinery.

3. **Icons:** `BsStars` (`react-icons/bs` — same package as `OpenCart.tsx`'s
   `BsCart3`, no new icon package) for the FAB, `FaXmark` (`react-icons/fa6` —
   same as `CloseCart.tsx`) for the modal close button. Sized via `className`
   only, matching the existing convention.

4. **Starter prompt copy** (this repo is a generic "Commerceplate" boilerplate
   storefront, not a specific vertical, so copy stays generic/store-agnostic):
   - "Find me a gift under $50" → text reply + 2 fixture product cards
   - "What's trending right now?" → text reply + 2 fixture product cards
   - "Do you ship internationally?" → text-only reply (policy-style, no cards)
   - "Help me pick between two jackets" → text-only reply (comparison-style)

   Two starters exercise the product-card path, two exercise text-only, so
   both rendering paths get covered without a dedicated task for each.

## Task List

Tasks are tracked in `todo.md`. Ordered summary:

### Phase 1: Foundation + empty shell
- Task 1: Types, fixtures, and script data
- Task 2: FAB + empty modal shell (open/close works end-to-end)

### Checkpoint: After Tasks 1–2
- `npm run build` succeeds; `npm run lint` passes.
- Manual: FAB open/close (Escape/backdrop/button) works on desktop + mobile
  viewport, light + dark mode.
- Review with human before proceeding to chat logic.

### Phase 2: Conversation logic
- Task 3: Starter prompts + text-only scripted reply
- Task 4: Product-card scripted replies + Add to cart toggle

### Checkpoint: After Tasks 3–4
- All 4 starters produce their scripted output correctly; free-text fallback
  works; add-to-cart toggle is local-only and survives close/reopen; real
  cart unaffected; lint/build pass.
- Review with human before the polish pass.

### Phase 3: Polish & verification
- Task 5: Accessibility, persistence, dark mode, and final pass

### Checkpoint: Complete
- All `spec.md` success criteria met; lint/build clean; no file outside
  `src/layouts/components/assistant/` and the single mount line in
  `src/app/layout.tsx` touched; no new npm dependency added.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Native `<dialog>` centering/backdrop styling fights Tailwind defaults (browser UA styles) | Low | Reset with `p-0 m-auto border-none` on `<dialog>`, verify visually in Task 2 before building chat logic on top |
| Typewriter `setInterval` effect trips `react-hooks/exhaustive-deps` (error, not warning, in this repo's ESLint config) | Med | Keep the interval effect scoped to one message id as its only dependency; clear on cleanup; verify `npm run lint` at the end of Task 3 |
| Scope creep into real cart/backend integration | Med | Boundaries section in `spec.md` explicitly forbids this; Task 4's acceptance criteria explicitly checks the real cart is untouched |

## Open Questions

None — starter copy and icon choices are locked in above (Architecture
Decisions §3–4) rather than left as open questions, since `spec.md` explicitly
delegated that judgment call to planning/implementation.
