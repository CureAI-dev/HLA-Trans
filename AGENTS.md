# AGENTS.md

Heart donor–recipient compatibility demo. TanStack Start (React 19) + TanStack Query/Router, Drizzle + `pg` on Postgres 18, separate Bun worker for background match runs. Package manager is **Bun** (`bun.lock`; `.npmrc` sets `legacy-peer-deps`).

## Commands

- Setup: `cp .env.example .env && bun install --frozen-lockfile && bun run db:up && bun run db:migrate` (`db:seed` is optional).
- `bun run dev` starts **both** web (`:3000`) and worker. `dev:web` alone never processes match runs.
- Every commit must pass: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:db`.
- Single unit test: `bunx vitest run path/to/file.test.ts`. Single DB test: `bunx vitest run --config vitest.db.config.ts path/to/x.db.test.ts` (run `bun run db:migrate:test` first).
- `bun run check` is the **Prettier check**, not typecheck. `bun run format` writes.
- `bun run check:bundle` builds, then fails if `drizzle-orm`, `pg` or `DATABASE_URL` shows up in client JS, or if initial JS is over 250 KiB gzip. Run it after touching server/client boundaries or adding heavy client deps.
- `bun run perf` truncates `PERF_DATABASE_URL`. `load-test.ts --seed-only --wipe-dev-data` wipes the dev DB.

## Databases (Podman, not Docker)

- `db:up` / `db:down` use `podman compose`. Dev DB `postgres` on **:5442** (persistent volume); test DB `postgres-test` on **:5444** (tmpfs, wiped on restart, so re-run `db:migrate:test`).
- DB tests (`*.db.test.ts`) are excluded from `bun run test`. They need `TEST_DATABASE_URL`, run serially against one shared DB, and reset it with `resetTestDb()` (TRUNCATE) from `src/server/db/test-db.server.ts`.
- Schema changes: edit `src/server/db/schema.server.ts` → `bun run db:generate` → commit the SQL and `meta/` files. Triggers, extensions and custom indexes go in hand-written migrations (see `0001_extensions_triggers.sql`), not in the Drizzle schema.
- In non-production, the worker applies migrations itself on startup.
- `env.server.ts` calls `process.loadEnvFile()` because Vite does not expose non-`VITE_` vars to `process.env`.

## Architecture boundaries

- `src/domain/`: the pure engine (zod schemas, rules, calc). It runs in the browser (live preview), in server functions and in the worker. **No** React, browser APIs, `pg`/Drizzle, `node:*`, or imports from `features/`, `server/` or `lib/`. Bump `ENGINE_VERSION` in `engine.ts` when rule output changes.
- `src/server/**`: server-only, and every file is named `*.server.ts`. Only these files (plus `src/worker/**`, `scripts/`, `drizzle.config.ts`) may import `pg`, Drizzle or `node:*`. All SQL lives in `server/repos/`. Repos take an `Executor` (db or tx).
- `src/features/<x>/`: `*.functions.ts` (thin `createServerFn`: zod validator → one repo/service call), `*.queries.ts` (key factory + `queryOptions`), `*.mutations.ts` (hooks).
  - Reads use `readMiddleware`, writes use `writeMiddleware`. Both need a signed-in user (Neon Auth via `server/auth.server.ts`, `UNAUTHENTICATED` otherwise) and give you `context.user` and `context.actor` (the user's name). Only the `features/auth` functions use bare `errorMiddleware`.
- `src/routes/` stays thin: `validateSearch`, then a loader with `context.queryClient.ensureQueryData(...)`, then `useSuspenseQuery` in the component. `src/routeTree.gen.ts` is generated (by the Vite plugin, or `bun run generate-routes`). Never hand-edit it.
- Creating or updating a patient/donor queues a match run **in the same transaction** (`server/services/records.server.ts`). NOTIFY fires on commit, and the worker claims runs with `FOR UPDATE SKIP LOCKED`.
- `src/components/ui/**` is vendored shadcn code (style `base-lyra`, Base UI, not Radix) and is not linted. Add components with the shadcn CLI.

## Invariants that are easy to break

- `audit_log`, `match_results`, `criteria_versions`, `record_snapshots` and `decisions` are append-only. DB triggers reject UPDATE/DELETE, so insert new rows instead.
- Write every timestamp from app code with `new Date()`. Never use `now()` or `defaultNow()`, because keyset cursors depend on millisecond precision.
- IDs are `text` (≤64 chars, prefixed, from `newId(prefix)` in `domain/factories.ts`), not uuid columns.
- Patient/donor updates need `expectedVersion` (optimistic concurrency → `CONFLICT`).
- The server always recomputes engine results and never stores a result sent by the client. Decisions are only allowed on `source = 'checked'` results.
- Safety rule: missing or unknown clinical input produces REVIEW (`missing: true`), never PASS. See v1 spec §3 in `docs/specs/`.
- Internal links use `<Link>` / `navigate()`. ESLint rejects raw `<a href="/...">`.
- UI copy: "Match result", "Match run", "Matching", "Check a pair". The word "evaluation" must not appear in user-visible text (domain type names like `EvaluationResult` are fine, and `/evaluations/*` routes only redirect). Demo data must never contain "Fictional".

## Style

Prettier: no semicolons, double quotes, `es5` trailing commas, Tailwind class sorting (also inside `cn`/`cva`). Path alias `@/*` → `src/*`.

## Docs

The design sources of truth are `docs/specs/*-v2-postgres-matching-ux-spec.md` (architecture, perf budgets §10) and the v1 spec (safety rules). The plans in `docs/plans/` are history.
