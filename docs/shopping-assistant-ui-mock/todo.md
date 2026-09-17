# Todo: Shopping Assistant Modal (UI-only)

See `tasks/plan.md` for full context and architecture decisions, `SPEC.md`
for the full spec.

### Phase 1: Foundation + empty shell

- [x] Task 1: Types, fixtures, and script data
  - **Description:** Add the static data layer the rest of the feature is
    built on: message/product/starter types, fixture product data, and the
    scripted starter → reply mapping.
  - **Acceptance criteria:**
    - [x] `types.ts` defines `ChatMessage`, `FixtureProduct`, `Starter`/
          `ScriptedReply`.
    - [x] `fixtures.ts` exports 2–3 `FixtureProduct` entries using
          `/images/product-1.png` and/or `/images/image-placeholder.png`.
    - [x] `script.ts` exports the 4 starters (see plan §Architecture
          Decisions 4) plus a fallback message constant.
  - **Verification:**
    - [x] `npx eslint src/layouts/components/assistant/` — clean.
          (Standalone `npx tsc --noEmit` hits a pre-existing, unrelated
          `tsconfig.json` deprecation error (`baseUrl`) on this repo, not
          caused by these files; full type-check is covered by `npm run
          build` at Task 2's checkpoint.)
  - **Dependencies:** None
  - **Files:**
    - `src/layouts/components/assistant/types.ts`
    - `src/layouts/components/assistant/fixtures.ts`
    - `src/layouts/components/assistant/script.ts`
  - **Estimated scope:** Small (3 files)

- [x] Task 2: FAB + empty modal shell (open/close works end-to-end)
  - **Description:** Build the FAB trigger and the native-`<dialog>`-based
    modal shell, mounted globally, with a placeholder chat body. This is the
    first fully clickable, testable slice.
  - **Acceptance criteria:**
    - [x] Clicking the FAB opens a centered dialog with a backdrop.
    - [x] Escape, backdrop click, and an explicit close button (`FaXmark`)
          all close it.
    - [x] FAB renders on every page (home, a product page, a content page).
  - **Verification:**
    - [x] `npm run build` — clean (Turbopack compile + TypeScript + static
          generation all succeeded).
    - [x] `npm run lint` — clean.
    - [x] Manual verification via Chrome DevTools MCP: opened the FAB on the
          homepage and a product page; confirmed dialog centers with
          backdrop in dark mode; confirmed Escape, backdrop-click, and the
          close button all close the dialog and each one restores focus to
          the FAB automatically (native `<dialog>` behavior — no extra code
          needed); confirmed near-full-screen sizing at a 390×844 mobile
          viewport in light mode. No console errors attributable to the new
          components (one pre-existing, unrelated hydration warning was
          observed in the `Social` share-links component).
  - **Dependencies:** Task 1 (types only, minimal)
  - **Files:**
    - `src/layouts/components/assistant/AssistantButton.tsx` (new)
    - `src/layouts/components/assistant/AssistantModal.tsx` (new)
    - `src/layouts/components/assistant/AssistantChat.tsx` (new, placeholder)
    - `src/app/layout.tsx` (one-line mount)
  - **Estimated scope:** Medium (4 files)

## Checkpoint: After Tasks 1–2
- [x] `npm run build` succeeds
- [x] `npm run lint` passes
- [x] Manual: FAB open/close (Escape/backdrop/button) works on desktop +
      mobile viewport, light + dark mode
- [ ] Review with human before proceeding to chat logic

### Phase 2: Conversation logic

- [x] Task 3: Starter prompts + text-only scripted reply
  - **Description:** Wire the real chat interaction for the two text-only
    starters: greeting/starters empty state, user message, shimmer loading
    state, typewriter-streamed assistant reply, and the free-text fallback
    path.
  - **Acceptance criteria:**
    - [x] Clicking a text-only starter shows: user bubble → shimmer → typed
          assistant reply, matching the scripted text.
    - [x] Free-text input (typed manually, not a starter) gets the fallback
          message.
  - **Verification:**
    - [x] `npm run build` — clean.
    - [x] `npm run lint` — clean (required reworking the typewriter effect
          to satisfy `react-hooks/refs` and `react-hooks/set-state-in-effect`
          without suppression comments — see commit message).
    - [x] Manual via Chrome DevTools MCP: both text-only starters produced
          the correct scripted reply after a shimmer delay; free text not
          matching a starter got the fallback message; fixed a real
          accessibility issue found in the console (`input` missing a
          `name` attribute) before considering this done.
  - **Dependencies:** Task 1, Task 2
  - **Files:**
    - `src/layouts/components/assistant/StarterPrompts.tsx` (new)
    - `src/layouts/components/assistant/MessageBubble.tsx` (new)
    - `src/layouts/components/assistant/AssistantChat.tsx` (replace
      placeholder with real logic)
  - **Estimated scope:** Medium (3 files)

- [x] Task 4: Product-card scripted replies + Add to cart toggle
  - **Description:** Add the product-card rendering path: a fixture product
    card component and the two product-bearing starters, with a local-only
    "Add to cart" → "Added" toggle.
  - **Acceptance criteria:**
    - [x] Clicking a product-card starter shows text, then 2 product cards.
    - [x] Clicking "Add to cart" on a card flips it to "Added" and stays that
          way if the modal is closed and reopened.
    - [x] The real cart (header cart icon/count) is untouched.
  - **Verification:**
    - [x] `npm run build` — clean.
    - [x] `npm run lint` — clean.
    - [x] Manual via Chrome DevTools MCP: both product-card starters render
          their 2 fixture cards after the text streams in; "Add to cart"
          flips to a disabled "Added ✓" state that survives close/reopen and
          a dark-mode toggle (same mounted `AssistantChat` instance, per the
          Task 2 architecture decision); confirmed the header cart icon has
          no quantity badge (still empty) after clicking it.
    - Note: mid-task, the long-running dev server (up ~1h35m across this
      whole build session) started serving a stale server-rendered starter
      order that didn't match the edited source (a hydration-mismatch
      console error). Confirmed via `curl` that only the server output was
      stale, not the client bundle; restarting the dev process fixed it.
      Not a code bug — the homepage is `export const dynamic =
      "force-dynamic"`, so no route caching should apply; treated as a
      Turbopack dev-server staleness artifact.
  - **Dependencies:** Task 1, Task 3
  - **Files:**
    - `src/layouts/components/assistant/ProductCard.tsx` (new)
    - `src/layouts/components/assistant/script.ts` (edit)
    - `src/layouts/components/assistant/fixtures.ts` (edit)
    - `src/layouts/components/assistant/AssistantChat.tsx` (edit)
    - `src/layouts/components/assistant/MessageBubble.tsx` (edit)
  - **Estimated scope:** Medium (5 files)

## Checkpoint: After Tasks 3–4
- [x] All 4 starters produce their scripted output correctly
- [x] Free-text fallback works
- [x] Add-to-cart toggle is local-only and survives close/reopen; real cart
      unaffected
- [x] `npm run lint` && `npm run build` pass
- [ ] Review with human before the polish pass

### Phase 3: Polish & verification

- [x] Task 5: Accessibility, persistence, dark mode, and final pass
  - **Description:** Close out the remaining `SPEC.md` requirements that are
    mostly verification rather than new code: aria attributes, focus
    restoration, persistence behavior, dark mode, and mobile sizing.
  - **Acceptance criteria:**
    - [x] Every item in `SPEC.md`'s "Testing Strategy" (all 9 steps) passes
          manually.
  - **Verification:**
    - [x] Manual walkthrough of all 9 steps in `SPEC.md` via Chrome DevTools
          MCP:
          1. FAB confirmed on home, a product page, `/about`, and `/contact`.
          2. FAB opens a centered modal with backdrop; focus moves in
             automatically (native `<dialog>`).
          3. All 4 starters individually verified end-to-end (shimmer →
             typewriter text → product cards where scripted).
          4. Free text not matching a starter gets the fallback message.
          5. Escape / backdrop click / close button all close it and
             restore focus to the FAB (native `<dialog>` behavior).
          6. Sent a message on `/about`, clicked a real `<Link>` to
             `/contact` (client-side nav, confirmed no full page load in
             the snapshot), reopened the FAB — conversation was retained.
          7. Full reload (`F5`) resets to the empty greeting/starters state.
          8. Dark mode toggle verified for the modal, FAB, and product
             cards (including the "Added ✓" state, which survived the
             toggle since it's the same mounted instance).
          9. `npm run lint` — clean.
    - [x] `npm run build` — clean.
    - [x] `npx prettier --check` — found 2 files never run through this
          repo's format script; fixed with `--write` (whitespace/line-wrap
          only, confirmed via `git diff`, no behavior change).
    - No accessibility or persistence gaps were found requiring new code —
      the native `<dialog>` + mount-once decisions from Tasks 2 and 3
      already covered all of it. Also re-checked mobile (390×844): the
      modal goes near-full-screen and product cards stack/wrap cleanly with
      no horizontal overflow.
  - **Dependencies:** Tasks 1–4
  - **Files:** `AssistantChat.tsx`, `StarterPrompts.tsx` (prettier
    formatting only) — no new files
  - **Estimated scope:** Medium (verification-heavy; only a formatting fix
    was needed)

## Checkpoint: Complete
- [x] All `SPEC.md` success criteria met
- [x] `npm run lint` && `npm run build` clean
- [x] No file outside `src/layouts/components/assistant/` and the single
      mount line in `src/app/layout.tsx` was touched
- [x] No new npm dependency was added
- [x] Ready for human review / commit
