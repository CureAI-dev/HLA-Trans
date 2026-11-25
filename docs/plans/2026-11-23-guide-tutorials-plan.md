# Concord Guide Implementation Plan

**Goal:** 17 in-app tutorials (105 steps) behind one Open Guide button, plus shadcn scrollbars and smooth focus in the whole app.

**Architecture:** `src/features/guide/` holds a small store and the sidebar card in the initial bundle. The dialog, the tutorial data, driver.js and its skin load on first use. Every step names a location (path and search) and a CSS target, so all screen state that a step needs is in the URL. Screens that need a record use `practice` search flags or the `/practice/$screen` route with demo records and the pure engine.

**Tech stack:** driver.js 1.14.0, Base UI ScrollArea and Dialog (shadcn), TanStack Router, Vitest.

**Spec:** `docs/specs/2026-11-23-guide-tutorials-spec.md`

## Global constraints

- No tutorial step saves, deletes, publishes, imports or resets.
- No "evaluation" in visible text, no "Fictional" in demo data.
- Step text: easy words, full sentences, at most 80 words.
- Initial JS stays under 250 KiB gzip (`bun run check:bundle`).
- `typecheck`, `lint`, `test`, `test:db` pass after every task.

## Tasks

### 1. Scroll area in the app frame
Files: `components/ui/scroll-area.tsx`, `components/app/app-shell.tsx`, `components/app/app-sidebar.tsx`, `routes/sign-in.tsx`, `router.tsx`, `components/form/use-scroll-spy.ts`, `styles.css`.
Produces: `ScrollArea({ orientation?, viewportProps? })`, `APP_SCROLL_ID = "app-scroll"` in `lib/app-scroll.ts`.
- [x] ScrollArea gains `orientation` ("vertical" | "horizontal" | "both"), `viewportProps` and `ScrollArea.Content`, so the thumb follows content changes.
- [x] AppShell is an `h-dvh` frame. Router gets `scrollToTopSelectors`. Scroll spy root is the viewport.
- [x] Tables, form columns, dialog and popup lists use it. CSS fallback for textareas.
- [x] Check in a browser: back and forward restore the position, sticky bars stick, hash links land, no native bar.

### 2. Smooth focus
Files: `styles.css`, `components/ui/{input,textarea,select,input-group,button,checkbox,toggle,tabs}.tsx` where `transition-colors` hides the ring change.
- [x] 180 ms fade for border, ring and outline. Instant with reduced motion.

### 3. Guide core
Files: `features/guide/{guide.types,guide-meta,guide-progress,guide-store,guide-runner}.ts`, `features/guide/components/*`, `features/guide/guide.css`.
Produces: `startTutorial(id, step)`, `openGuide()`, `useGuide()`, `Tutorial`, `Step`.
- [x] Tests first for progress (damaged storage, unknown ids) and search.
- [x] Runner: locate, wait for the target, skip optional, try gate, pause, resume, finish.
- [x] Card, dialog with doctor, welcome and finished cards.

### 4. Practice screens
Files: `features/guide/practice.ts`, `routes/practice/$screen.tsx`, `routes/matches/check.tsx`, `routes/{patients,donors}/new.tsx`, form and decision components.
- [x] Test first: practice pair REVIEW, PASS, REVIEW (250 min), FAIL.

### 5. Tutorials and targets
Files: `features/guide/tutorials/*.ts`, `data-guide` attributes in pages and components.
- [x] Tests first: unique ids, word limit, forbidden words, sidebar coverage, every target in source.

### 6. Verification
- [x] Browser walk at 1360 px and 390 px, light and dark, with no write request sent.
- [x] All checks and `check:bundle`. README and AGENTS.md notes.
