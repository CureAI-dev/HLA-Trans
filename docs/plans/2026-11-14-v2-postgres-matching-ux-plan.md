# HLA-Trans v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HLA-Trans from localStorage to PostgreSQL (Podman), run matching in the background with live status, and rebuild navigation, loading, lists, detail pages, forms and the result view so the app feels instant.

**Architecture:** The pure domain engine is unchanged and shared by three callers: the browser (live preview), TanStack Start server functions (authoritative writes) and a separate worker process (match runs). Postgres holds the clinical records (validated `jsonb` plus indexed summary columns), immutable snapshots and results, and the job queue (`FOR UPDATE SKIP LOCKED` + `LISTEN/NOTIFY`). The client reads through TanStack Query `queryOptions`, which route loaders warm (`ensureQueryData`) under SSR via `@tanstack/react-router-ssr-query`.

**Tech Stack:** TanStack Start 1.169.5 / Router 1.170.46 (React 19), TanStack Query 5.107.1, Drizzle ORM 0.45.4 + drizzle-kit 0.31.11, node-postgres 8.23.1, PostgreSQL 18.3 (Podman), zod 4.6, shadcn (Base UI, lyra), Tailwind v4, Vitest 5, Bun 1.4.

**Spec:** `docs/specs/2026-11-14-v2-postgres-matching-ux-spec.md` (builds on `docs/specs/2026-11-14-heart-compatibility-spec.md`)

## Global Constraints

- The v1 safety rules (v1 spec §3) still apply. Missing input → REVIEW with `missing: true`, never PASS. The app advises; the clinician decides.
- `src/domain/**` stays pure: no React, no browser APIs, no `pg`/Drizzle, no imports from `features/`, `server/` or `lib/`.
- **IDs are `text` (max 64 chars), not `uuid`.** Existing records use prefixed IDs (`pat_<uuid>`, `sample-patient-1`), and the import must preserve them. This corrects spec §3.1. New IDs come from `newId(prefix)` in `src/domain/factories.ts`.
- **Every timestamp is written from application code with millisecond precision** (`new Date()`), never with `now()`/`defaultNow()`. Keyset cursors depend on it. Columns are `timestamptz` and are read with Drizzle `mode: "date"`. The API serialises them with `toISOString()`.
- **Database:** `DATABASE_URL=postgres://postgres:password@localhost:5442/main`. **Tests:** `TEST_DATABASE_URL=postgres://postgres:password@localhost:5444/main` (tmpfs container). These credentials are local-only, not secrets.
- **Only `src/server/**/*.server.ts` files** (plus `src/worker/**` and `drizzle.config.ts`) may import `pg`, `drizzle-orm/node-postgres` or `node:*`. Start's import protection enforces the default `**/*.server.*` rule. Server functions live in `src/features/*/*.functions.ts` and import from `.server.ts` only inside handlers.
- **Internal navigation uses `<Link>` or `navigate()` only.** A raw `<a href="/…">` fails lint.
- **UI naming:** "Matching" (runs), "Match results" (saved results), "Check a pair" (manual check), "Match run", "Match result". The word "evaluation" must not appear in user-visible text. Domain type names (`EvaluationResult`) stay.
- **Immutability:** `UPDATE`/`DELETE` on `audit_log`, `match_results`, `criteria_versions` and `record_snapshots` raise an exception from a trigger. `TRUNCATE` (used only by the audited Reset action and by tests) is allowed.
- **Decisions** may only be recorded on results with `source = 'checked'`.
- **Performance budgets** (spec §10) are acceptance criteria, not goals.
- **Every commit passes** `bun run typecheck`, `bun run lint` and `bun run test`. From Task 2 on, `bun run test:db` also passes, with the test container up.
- **Copy:** synthetic demo data never contains the words "Fictional"/"FICTIONAL". The demo banner reads: "Demo environment: synthetic records. Not for clinical use."

## File map

| Path | Responsibility | Task |
|---|---|---|
| `compose.yaml`, `.env.example`, `drizzle.config.ts` | Local Postgres, env, migrations config | 2 |
| `src/server/env.server.ts` | Validated server env | 2 |
| `src/server/db/client.server.ts` | Pool + Drizzle singleton, `Executor` type | 2 |
| `src/server/db/schema.server.ts` | Drizzle tables | 2 |
| `src/server/db/migrations/*` | Generated + custom SQL (extensions, trigram, triggers) | 2 |
| `src/server/db/migrate.server.ts` | Programmatic migrator | 2 |
| `src/server/db/test-db.server.ts` | Test helpers (connect, migrate, truncate) | 2 |
| `src/lib/cursor.ts` | Keyset cursor encode/decode (pure) | 3 |
| `src/lib/app-error.ts` | `AppError`, `toAppError`, serialization adapter | 3 |
| `src/domain/match-types.ts` | Shared API row types | 3 |
| `src/domain/screen-key.ts` | Sortable screening key (pure) | 5 |
| `src/server/repos/*.server.ts` | All SQL: snapshots, audit, patients, donors, criteria, matches, runs, data | 3–5, 7 |
| `src/server/matching/process-run.server.ts` | Chunked run processing | 5 |
| `src/worker/main.ts` | Worker process | 5 |
| `src/lib/query-client.ts`, `src/lib/prefs.ts` | QueryClient factory; cookie prefs | 6 |
| `src/features/shared/middleware.ts` | Actor + error middleware | 6 |
| `src/features/<feature>/*.functions.ts / *.queries.ts / *.mutations.ts` | Server fns, query options, mutation hooks | 6 |
| `src/components/app/{top-progress,page-skeletons,route-error,page-actions}.tsx` | Loading/error/actions UI | 8, 9 |
| `src/components/app/list-toolbar.tsx`, `src/components/app/pager.tsx` | Filter toolbar, keyset pager | 9 |
| `src/features/matching/components/*` | Run indicator, run cards, history | 10 |
| `src/domain/risk-flags.ts` | Pure risk flags + tests | 11 |
| `src/components/record/*` | Read-only record renderer | 11 |
| `src/components/form/{date-picker-field,form-layout,unsaved-guard}.tsx` | Form UX | 12 |
| `src/components/match/*` (moved from `components/evaluation`) | Result view redesign | 13 |
| `src/domain/demo-data/*` | Realistic seed + scenario coverage | 14 |
| `scripts/load-test.ts` | Performance verification | 15 |

---

## Phase 0: Navigation and naming

### Task 1: Router links everywhere, the raw-anchor lint rule, and the new route names

Fixes item 1 (full reloads) and item 6 (naming). Storage is still localStorage in this task, so it can ship alone.

**Files:**
- Modify: `eslint.config.js`
- Modify: `src/components/app/app-sidebar.tsx`, `src/components/app/page-header.tsx`
- Modify (anchor → Link): `src/components/patient/patient-table.tsx`, `src/components/patient/patient-form.tsx`, `src/components/donor/donor-form.tsx`, `src/components/donor/donor-table.tsx`, `src/components/donor/screening-table.tsx`, `src/components/evaluation/result-view.tsx`, `src/routes/donors/$donorId.edit.tsx`, `src/routes/donors/$donorId.index.tsx`, `src/routes/donors/index.tsx`, `src/routes/audit.tsx`, `src/routes/patients/index.tsx`, `src/routes/patients/$patientId.index.tsx`, `src/routes/patients/$patientId.edit.tsx`, `src/routes/index.tsx`
- Move: `src/routes/evaluations/index.tsx` → `src/routes/matches/index.tsx`; `src/routes/evaluations/new.tsx` → `src/routes/matches/check.tsx`; `src/routes/evaluations/$evaluationId.tsx` → `src/routes/matches/$matchId.tsx`
- Create (redirect stubs): `src/routes/evaluations/index.tsx`, `src/routes/evaluations/new.tsx`, `src/routes/evaluations/$evaluationId.tsx`

**Interfaces:**
- Produces: routes `/matches`, `/matches/check` (search `{ patientId?: string; donorId?: string }`) and `/matches/$matchId`. `PageHeader` breadcrumbs become `Array<{ label: string; link?: LinkOptions }>`.

- [ ] **Step 1: Add the lint rule**

In `eslint.config.js`, add this object after the first rules object:

```js
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // \x2F is "/": esquery regex literals cannot contain a raw slash.
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] > Literal[value=/^\\x2F/]",
          message:
            "Use <Link to> for internal navigation. A raw <a href> reloads the whole page.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] TemplateLiteral > TemplateElement:first-child[value.raw=/^\\x2F/]",
          message:
            "Use <Link to params search> for internal navigation. A raw <a href> reloads the whole page.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] ConditionalExpression",
          message:
            "Conditional hrefs hide internal links from lint. Use <Link> with typed options.",
        },
      ],
    },
  },
```

- [ ] **Step 2: Run lint and confirm it finds the violations**

Run: `bun run lint 2>&1 | grep -c "no-restricted-syntax"`
Expected: about 40 (every internal anchor listed in Files).

- [ ] **Step 3: Rename the routes and add redirect stubs**

```bash
mkdir -p src/routes/matches
git mv src/routes/evaluations/index.tsx src/routes/matches/index.tsx
git mv src/routes/evaluations/new.tsx src/routes/matches/check.tsx
git mv src/routes/evaluations/\$evaluationId.tsx src/routes/matches/\$matchId.tsx
```

In the moved files, change the `createFileRoute` paths to `"/matches/"`, `"/matches/check"` and `"/matches/$matchId"`. In `$matchId.tsx`, rename the param from `evaluationId` to `matchId`.

Create `src/routes/evaluations/index.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/evaluations/")({
  beforeLoad: () => {
    throw redirect({ to: "/matches", replace: true })
  },
})
```

Create `src/routes/evaluations/new.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

export const Route = createFileRoute("/evaluations/new")({
  validateSearch: z.object({
    patientId: z.string().optional().catch(undefined),
    donorId: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/matches/check", search, replace: true })
  },
})
```

Create `src/routes/evaluations/$evaluationId.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/evaluations/$evaluationId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/matches/$matchId",
      params: { matchId: params.evaluationId },
      replace: true,
    })
  },
})
```

Run: `bun run generate-routes`
Expected: `src/routeTree.gen.ts` lists `/matches/`, `/matches/check`, `/matches/$matchId` and the three `/evaluations` redirects.

- [ ] **Step 4: Rewrite the sidebar with `Link`**

Replace `src/components/app/app-sidebar.tsx` with:

```tsx
import { Link, useRouterState } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { Activity } from "lucide-react"
import { cn } from "cn"

type NavItem = {
  label: string
  link: LinkOptions
  isActive: (pathname: string) => boolean
}
const under = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`)

const items: ReadonlyArray<NavItem> = [
  { label: "Dashboard", link: { to: "/" }, isActive: (p) => p === "/" },
  { label: "Patients", link: { to: "/patients" }, isActive: under("/patients") },
  { label: "Donors", link: { to: "/donors" }, isActive: under("/donors") },
  {
    label: "Match results",
    link: { to: "/matches" },
    isActive: (p) => under("/matches")(p) && p !== "/matches/check",
  },
  {
    label: "Check a pair",
    link: { to: "/matches/check" },
    isActive: (p) => p === "/matches/check",
  },
  { label: "Criteria", link: { to: "/criteria" }, isActive: under("/criteria") },
  { label: "Audit log", link: { to: "/audit" }, isActive: under("/audit") },
  { label: "Data", link: { to: "/data" }, isActive: under("/data") },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2 border-b px-5 py-5 text-lg font-semibold"
      >
        <Activity className="size-5 text-primary" aria-hidden="true" />
        HLA-Trans
      </Link>
      <p className="px-5 pt-5 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Heart compatibility
      </p>
      <nav aria-label="Main navigation" className="space-y-1 px-3">
        {items.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.label}
              {...item.link}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm hover:bg-sidebar-accent",
                active && "border-primary bg-sidebar-accent font-semibold"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <p className="mt-auto border-t p-5 text-xs leading-relaxed text-muted-foreground">
        Clinical review workspace
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Make breadcrumbs typed**

In `src/components/app/page-header.tsx`, change the breadcrumb type and rendering:

```tsx
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
// …
  breadcrumbs?: Array<{ label: string; link?: LinkOptions }>
// …
                {item.link ? (
                  <Link {...item.link} className="underline underline-offset-4">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current="page">{item.label}</span>
                )}
```

- [ ] **Step 6: Convert every remaining internal anchor**

Apply these exact patterns to each file reported in Step 2:

| Before | After |
|---|---|
| `<a href="/patients/new" className="…">` | `<Link to="/patients/new" className="…">` |
| ``<a href={`/patients/${p.id}`}>`` | `<Link to="/patients/$patientId" params={{ patientId: p.id }}>` |
| ``<a href={`/donors/${d.id}/edit`}>`` | `<Link to="/donors/$donorId/edit" params={{ donorId: d.id }}>` |
| ``<a href={`/evaluations/${e.id}`}>`` | `<Link to="/matches/$matchId" params={{ matchId: e.id }}>` |
| ``<a href={`/evaluations/new?patientId=${…}&donorId=${…}`}>`` | `<Link to="/matches/check" search={{ patientId: …, donorId: … }}>` |
| `<a href="/evaluations/new">` | `<Link to="/matches/check">` |
| `<a href="/evaluations">` | `<Link to="/matches">` |

`result-view.tsx` builds its "Review inputs" href with a nested ternary. Replace that with a small typed helper inside the file:

```tsx
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"

function reviewLink(
  rule: string,
  saved: boolean,
  patientId: string,
  donorId: string
): LinkOptions | null {
  if (rule === "logistics")
    return saved
      ? { to: "/matches/check", search: { patientId, donorId }, hash: "pair-inputs" }
      : null // live preview: the pair inputs are on this page
  if (rule === "donorHeart")
    return { to: "/donors/$donorId/edit", params: { donorId } }
  return { to: "/patients/$patientId/edit", params: { patientId } }
}
```

Render `link ? <Link {...link} className="underline">Review inputs</Link> : <a className="underline" href="#pair-inputs">Review inputs</a>`. A hash-only `href` is allowed by the rule. Task 13 replaces this view entirely; this step only removes the full reloads.

- [ ] **Step 7: Rename user-visible copy**

Run: `grep -rniE "evaluation" src/routes src/components --include=*.tsx | grep -v "EvaluationResult\|evaluationId\|import"`

Replace each user-visible string using this table, and leave identifiers alone:

| Old copy | New copy |
|---|---|
| "New evaluation" | "Check a pair" |
| "Evaluations" / "Evaluation history" | "Match results" |
| "Save evaluation" | "Save match result" |
| "Frozen evaluation result" | "Saved match result" |
| "Live evaluation preview" | "Live preview" |
| "Start an evaluation" | "Check a pair" |
| "Discard unsaved evaluation changes?" | "Discard this unsaved pair check?" |
| "evaluation snapshots" | "saved match results" |

- [ ] **Step 8: Verify**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all pass, with 0 `no-restricted-syntax` errors.

Run `bun run dev`. Open http://localhost:3000, open DevTools → Network → filter "Doc", and click every sidebar item.
Expected: no new document requests after the first load. Visiting `/evaluations/new?patientId=x` lands on `/matches/check?patientId=x`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix(nav): client-side links everywhere, lint guard, rename evaluations to matches"
```

---

## Phase 1: PostgreSQL

### Task 2: Dependencies, Podman compose, Drizzle schema, migrations, triggers, test harness

**Files:**
- Modify: `package.json`, `.gitignore`, `vitest.config.ts`
- Create: `compose.yaml`, `.env.example`, `drizzle.config.ts`, `vitest.db.config.ts`
- Create: `src/server/env.server.ts`, `src/server/db/client.server.ts`, `src/server/db/schema.server.ts`, `src/server/db/migrate.server.ts`, `src/server/db/test-db.server.ts`, `scripts/migrate.ts`
- Create: `src/server/db/migrations/` (generated), plus custom migration `0001_extensions_triggers.sql`
- Test: `src/server/db/__tests__/immutability.db.test.ts`

**Interfaces:**
- Produces:
  - `getDb(): Db`
  - `createDb(url: string, opts: { max: number; statementTimeoutMs: number }): { pool: Pool; db: Db }`
  - types `Db`, `Tx`, `Executor = Db | Tx`
  - all table objects: `patients`, `donors`, `recordSnapshots`, `criteriaVersions`, `matchRuns`, `matchResults`, `decisions`, `auditLog`
  - `runMigrations(db: Db): Promise<void>`
  - test helpers `testDb(): Db`, `resetTestDb(): Promise<void>`, `closeTestDb(): Promise<void>`

- [ ] **Step 1: Pin the dependencies**

```bash
bun add --exact @tanstack/react-query@5.107.1 @tanstack/react-router-ssr-query@1.167.3 drizzle-orm@0.45.4 pg@8.23.1 \
  @tanstack/react-router@1.170.46 @tanstack/react-start@1.169.5 @tanstack/react-router-devtools@1.167.3 @tanstack/react-devtools@0.10.14
bun add --exact -d drizzle-kit@0.31.11 @types/pg@8.23.1 @tanstack/devtools-vite@0.8.6 @tanstack/eslint-config@0.5.0 @tanstack/react-query-devtools@5.107.1
```

Expected: no `"latest"` remains in `package.json` (`grep -c latest package.json` prints `0`).

- [ ] **Step 2: Compose file and env**

Create `compose.yaml`. This is the owner's file with one change: the project `name` is `hla-trans` instead of `sayaratak`. Compose prefixes container and volume names with the project name, so keeping `sayaratak` would make this app reuse the other project's containers and `pgdata` volume.

```yaml
# Local dev and test databases only. Credentials here are not secrets.
name: hla-trans
x-postgres: &postgres
  image: postgres:18.3-alpine3.23
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: password
    POSTGRES_DB: main
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d main"]
    interval: 2s
    timeout: 3s
    retries: 15

services:
  postgres:
    <<: *postgres
    ports: ["5442:5432"]
    volumes: ["pgdata:/var/lib/postgresql"]

  postgres-test:
    <<: *postgres
    ports: ["5444:5432"]
    tmpfs: ["/var/lib/postgresql"]
    # The tmpfs is small (memory): WAL capped well under it, and no fsync for
    # a database that is thrown away. The default 1 GB WAL filled it.
    command:
      - postgres
      - -c
      - max_wal_size=128MB
      - -c
      - fsync=off
      - -c
      - full_page_writes=off

volumes:
  pgdata:
```

Create `.env.example`:

```dotenv
DATABASE_URL=postgres://postgres:password@localhost:5442/main
TEST_DATABASE_URL=postgres://postgres:password@localhost:5444/main
```

Append to `.gitignore` (the existing `.env*` rule would otherwise hide the example):

```gitignore
!.env.example
```

Run: `cp .env.example .env && podman compose up -d && podman compose ps`
Expected: `postgres` and `postgres-test` are both `healthy`.

- [ ] **Step 3: Server env**

Create `src/server/env.server.ts`:

```ts
import { z } from "zod"

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })
const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
})
export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | undefined

/** Validated once per process. Throws a readable error instead of failing on first query. */
export function env(): ServerEnv {
  if (cached) return cached
  if (!process.env.DATABASE_URL) {
    try {
      // Vite does not copy non-VITE_ variables into process.env; Bun does.
      process.loadEnvFile()
    } catch {
      /* No .env file: validation below reports the missing variable. */
    }
  }
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success)
    throw new Error(
      `Invalid server environment (${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}). Copy .env.example to .env.`
    )
  cached = parsed.data
  return cached
}
```

- [ ] **Step 4: Drizzle schema**

Create `src/server/db/schema.server.ts`:

```ts
import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type {
  Criteria,
  Decision,
  Donor,
  EvaluationResult,
  PairInputs,
  Patient,
} from "@/domain/schema"

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" })

export const patients = pgTable(
  "patients",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    mrn: text("mrn").notNull(),
    fullName: text("full_name").notNull(),
    sortName: text("sort_name").notNull(),
    dateOfBirth: text("date_of_birth").notNull(),
    listingState: text("listing_state").notNull(),
    listingDate: text("listing_date").notNull(),
    urgencyStatus: text("urgency_status"),
    abo: text("abo"),
    device: text("device"),
    cpra: real("cpra"),
    /** snapshotHash(data). A result is out of date when its snapshot hash differs. */
    contentHash: text("content_hash").notNull(),
    data: jsonb("data").$type<Patient>().notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("patients_state_idx").on(t.listingState).where(sql`${t.deletedAt} is null`),
    index("patients_updated_idx").on(t.updatedAt.desc(), t.id.desc()),
    index("patients_name_idx").on(t.sortName, t.id),
    index("patients_listed_idx").on(t.listingDate.desc(), t.id.desc()),
  ]
)

export const donors = pgTable(
  "donors",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    donorCode: text("donor_code").notNull(),
    state: text("state").notNull(),
    abo: text("abo"),
    donationType: text("donation_type").notNull(),
    ageYears: integer("age_years"),
    hospital: text("hospital").notNull(),
    contentHash: text("content_hash").notNull(),
    data: jsonb("data").$type<Donor>().notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("donors_state_idx").on(t.state).where(sql`${t.deletedAt} is null`),
    index("donors_updated_idx").on(t.updatedAt.desc(), t.id.desc()),
    index("donors_code_idx").on(t.donorCode, t.id),
  ]
)

export const recordSnapshots = pgTable(
  "record_snapshots",
  {
    hash: text("hash").primaryKey(),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<Patient | Donor>().notNull(),
  },
  (t) => [check("record_snapshots_kind", sql`${t.kind} in ('patient','donor')`)]
)

export const criteriaVersions = pgTable("criteria_versions", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().unique(),
  author: text("author").notNull(),
  changeNote: text("change_note").notNull(),
  criteria: jsonb("criteria").$type<Criteria>().notNull(),
  createdAt: ts("created_at").notNull(),
})

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const
export const RUN_TRIGGERS = ["donor.created", "patient.created", "manual", "seed"] as const

export const matchRuns = pgTable(
  "match_runs",
  {
    id: text("id").primaryKey(),
    trigger: text("trigger").$type<(typeof RUN_TRIGGERS)[number]>().notNull(),
    subjectKind: text("subject_kind").$type<"patient" | "donor">().notNull(),
    subjectId: text("subject_id").notNull(),
    subjectLabel: text("subject_label").notNull(),
    criteriaVersionId: text("criteria_version_id")
      .notNull()
      .references(() => criteriaVersions.id),
    status: text("status").$type<(typeof RUN_STATUSES)[number]>().notNull(),
    total: integer("total"),
    processed: integer("processed").notNull().default(0),
    passCount: integer("pass_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    startedAt: ts("started_at"),
    heartbeatAt: ts("heartbeat_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    check("match_runs_status", sql`${t.status} in ('queued','running','succeeded','failed','cancelled')`),
    check("match_runs_subject_kind", sql`${t.subjectKind} in ('patient','donor')`),
    index("match_runs_active_idx")
      .on(t.status, t.createdAt)
      .where(sql`${t.status} in ('queued','running')`),
    index("match_runs_created_idx").on(t.createdAt.desc(), t.id.desc()),
    index("match_runs_subject_idx").on(t.subjectId, t.createdAt.desc()),
  ]
)

export const matchResults = pgTable(
  "match_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => matchRuns.id),
    source: text("source").$type<"screening" | "checked">().notNull(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    donorId: text("donor_id").notNull().references(() => donors.id),
    patientName: text("patient_name").notNull(),
    donorCode: text("donor_code").notNull(),
    patientSnapshot: text("patient_snapshot").notNull().references(() => recordSnapshots.hash),
    donorSnapshot: text("donor_snapshot").notNull().references(() => recordSnapshots.hash),
    criteriaVersionId: text("criteria_version_id").notNull().references(() => criteriaVersions.id),
    engineVersion: text("engine_version").notNull(),
    pair: jsonb("pair").$type<PairInputs>().notNull(),
    result: jsonb("result").$type<EvaluationResult>().notNull(),
    overall: text("overall").$type<"pass" | "review" | "fail">().notNull(),
    blockerCount: integer("blocker_count").notNull(),
    missingCount: integer("missing_count").notNull(),
    /** Fixed-width key from screenKey(); ORDER BY screen_key COLLATE "C". Null for patient runs and checked pairs. */
    screenKey: text("screen_key"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    check("match_results_source", sql`${t.source} in ('screening','checked')`),
    check("match_results_overall", sql`${t.overall} in ('pass','review','fail')`),
    check(
      "match_results_run_source",
      sql`(${t.source} = 'screening') = (${t.runId} is not null)`
    ),
    uniqueIndex("match_results_run_pair_uq")
      .on(t.runId, t.patientId, t.donorId)
      .where(sql`${t.runId} is not null`),
    index("match_results_created_idx").on(t.createdAt.desc(), t.id.desc()),
    index("match_results_donor_idx").on(t.donorId, t.createdAt.desc(), t.id.desc()),
    index("match_results_patient_idx").on(t.patientId, t.createdAt.desc(), t.id.desc()),
    index("match_results_run_idx").on(t.runId, t.overall),
  ]
)

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .unique()
    .references(() => matchResults.id),
  verdict: text("verdict").$type<Decision["verdict"]>().notNull(),
  clinician: text("clinician").notNull(),
  rationale: text("rationale").notNull(),
  reasons: jsonb("reasons").$type<Decision["reasons"]>().notNull(),
  acknowledgedFindings: boolean("acknowledged_findings").notNull(),
  decidedAt: ts("decided_at").notNull(),
})

export const auditLog = pgTable(
  "audit_log",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull().unique(),
    at: ts("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
  },
  (t) => [index("audit_at_id_idx").on(t.at.desc(), t.id.desc())]
)
```

- [ ] **Step 5: DB client and migrator**

Create `src/server/db/client.server.ts`:

```ts
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "./schema.server"
import { env } from "../env.server"

export type Db = NodePgDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
/** Repositories accept either the pool-backed db or an open transaction. */
export type Executor = Db | Tx

export type DbHandle = { pool: Pool; db: Db }

export function createDb(
  url: string,
  opts: { max: number; statementTimeoutMs: number }
): DbHandle {
  const pool = new Pool({
    connectionString: url,
    max: opts.max,
    idleTimeoutMillis: 30_000,
    statement_timeout: opts.statementTimeoutMs,
  })
  // Without a listener, an idle-client error (e.g. Postgres restart) crashes the process.
  pool.on("error", (error) => console.error("[db] idle client error:", error.message))
  return { pool, db: drizzle({ client: pool, schema }) }
}

const store = globalThis as typeof globalThis & { __hlaWebDb?: DbHandle }

/** One pool per web process; the globalThis slot survives Vite HMR module reloads. */
export function getDb(): Db {
  store.__hlaWebDb ??= createDb(env().DATABASE_URL, { max: 10, statementTimeoutMs: 5_000 })
  return store.__hlaWebDb.db
}
```

Create `src/server/db/migrate.server.ts`:

```ts
import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { Db } from "./client.server"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder })
}
```

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.server.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://postgres:password@localhost:5442/main" },
  strict: true,
})
```

Create `scripts/migrate.ts`:

```ts
import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"

const url = process.argv.includes("--test") ? env().TEST_DATABASE_URL : env().DATABASE_URL
if (!url) throw new Error("TEST_DATABASE_URL is not set.")
const { pool, db } = createDb(url, { max: 1, statementTimeoutMs: 60_000 })
await runMigrations(db)
await pool.end()
console.log(`Migrations applied to ${new URL(url).port}`)
```

Add these scripts to `package.json`:

```json
"db:up": "podman compose up -d",
"db:down": "podman compose down",
"db:generate": "drizzle-kit generate",
"db:migrate": "bun scripts/migrate.ts",
"db:migrate:test": "bun scripts/migrate.ts --test",
"db:studio": "drizzle-kit studio",
"test:db": "bun run db:migrate:test && vitest run --config vitest.db.config.ts"
```

- [ ] **Step 6: Generate migrations, then add the custom SQL migration**

Run: `bun run db:generate`
Expected: `src/server/db/migrations/0000_<name>.sql` and `meta/` are created.

Run: `bunx drizzle-kit generate --custom --name=extensions_triggers`
Expected: an empty `0001_extensions_triggers.sql`. Fill it with:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS patients_search_trgm ON patients USING gin (full_name gin_trgm_ops, mrn gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS donors_search_trgm ON donors USING gin (donor_code gin_trgm_ops, hospital gin_trgm_ops);
--> statement-breakpoint
-- Run detail pages order by screening key with byte (C) collation; see src/domain/screen-key.ts.
CREATE INDEX IF NOT EXISTS match_results_run_screen_idx ON match_results (run_id, screen_key COLLATE "C", id) WHERE run_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hla_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001', HINT = 'immutable';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER match_results_immutable BEFORE UPDATE OR DELETE ON match_results
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER criteria_versions_immutable BEFORE UPDATE OR DELETE ON criteria_versions
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER record_snapshots_immutable BEFORE UPDATE OR DELETE ON record_snapshots
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER decisions_immutable BEFORE UPDATE OR DELETE ON decisions
  FOR EACH ROW EXECUTE FUNCTION hla_reject_mutation();
```

- [ ] **Step 7: Test harness**

Create `src/server/db/test-db.server.ts`:

```ts
import { sql } from "drizzle-orm"
import { createDb } from "./client.server"
import type { Db, DbHandle } from "./client.server"
import { env } from "../env.server"

let handle: DbHandle | undefined

export function testDb(): Db {
  const url = env().TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL is required for db tests.")
  handle ??= createDb(url, { max: 6, statementTimeoutMs: 10_000 })
  return handle.db
}

export function testPool() {
  testDb()
  return handle!.pool
}

/** TRUNCATE bypasses the row-level immutability triggers by design. */
export async function resetTestDb(): Promise<void> {
  await testDb().execute(
    sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`
  )
}

export async function closeTestDb(): Promise<void> {
  await handle?.pool.end()
  handle = undefined
}
```

Create `vitest.db.config.ts`:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.db.test.ts"],
    environment: "node",
    fileParallelism: false, // one shared database
    testTimeout: 20_000,
  },
})
```

In `vitest.config.ts`, exclude DB tests from the default run:

```ts
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
    environment: "node",
  },
```

- [ ] **Step 8: Write the failing immutability test**

Create `src/server/db/__tests__/immutability.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq, sql } from "drizzle-orm"
import { auditLog, criteriaVersions } from "../schema.server"
import { closeTestDb, resetTestDb, testDb } from "../test-db.server"
import { DEFAULT_CRITERIA } from "@/domain/criteria"

const at = new Date("2026-11-14T12:00:00.000Z")

describe("append-only tables", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("rejects UPDATE and DELETE on audit_log", async () => {
    const db = testDb()
    await db.insert(auditLog).values({
      id: "aud_1", at, actor: "Dr Test", action: "data.seeded", subjectId: "x", summary: "s",
    })
    await expect(
      db.update(auditLog).set({ summary: "changed" }).where(eq(auditLog.id, "aud_1"))
    ).rejects.toThrow(/append-only/)
    await expect(db.delete(auditLog).where(eq(auditLog.id, "aud_1"))).rejects.toThrow(/append-only/)
  })

  it("rejects UPDATE on criteria_versions", async () => {
    const db = testDb()
    await db.insert(criteriaVersions).values({
      id: "crv_1", version: 1, author: "System", changeNote: "init", criteria: DEFAULT_CRITERIA, createdAt: at,
    })
    await expect(
      db.update(criteriaVersions).set({ changeNote: "x" }).where(eq(criteriaVersions.id, "crv_1"))
    ).rejects.toThrow(/append-only/)
  })

  it("allows TRUNCATE for reset", async () => {
    await testDb().execute(sql`TRUNCATE audit_log`)
  })
})
```

- [ ] **Step 9: Run it, then apply the migrations, then run it again**

Run: `bunx vitest run --config vitest.db.config.ts`
Expected: FAIL with `relation "audit_log" does not exist`.

Run: `bun run test:db`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(db): postgres via podman, drizzle schema, migrations and immutability triggers"
```

---

### Task 3: Shared primitives, snapshots, audit, patient and donor repositories

**Files:**
- Create: `src/lib/cursor.ts`, `src/lib/app-error.ts`, `src/domain/match-types.ts`
- Create: `src/server/repos/snapshots.server.ts`, `src/server/repos/audit.server.ts`, `src/server/repos/patients.server.ts`, `src/server/repos/donors.server.ts`, `src/server/repos/sql.server.ts`
- Test: `src/lib/__tests__/cursor.test.ts`, `src/lib/__tests__/app-error.test.ts`, `src/server/repos/__tests__/records.db.test.ts`

**Interfaces:**
- Consumes: `Executor`, the tables, `testDb`/`resetTestDb` (Task 2).
- Produces:
  - `encodeCursor(c: Cursor): string` and `decodeCursor(s: string): Cursor | null`, where `Cursor = { k: string; id: string }`
  - `class AppError(code: AppErrorCode, message: string, issues?: Record<string,string>)`, `isAppError`, `toAppError(e: unknown): AppError`, `errorMessage(e: unknown, fallback: string): string`
  - `Page<T> = { items: T[]; nextCursor: string | null }`
  - `PatientRow`, `DonorRow`, `PatientListInput`, `DonorListInput` (see code)
  - `snapshotHash(value: unknown): string`, `putSnapshots(exec, items: Array<{ kind: "patient" | "donor"; data: Patient | Donor }>): Promise<string[]>`
  - `appendAudit(exec, entry: AuditInput): Promise<void>`
  - patients repo: `listPatients`, `getPatient`, `insertPatient`, `updatePatient`, `softDeletePatient`, `activePatients`
  - donors repo: `listDonors`, `getDonor`, `insertDonor`, `updateDonor`, `softDeleteDonor`, `availableDonors`
  - Both repos keep `content_hash = snapshotHash(data)` current on every write.

- [ ] **Step 1: Write the failing cursor and error tests**

Create `src/lib/__tests__/cursor.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { decodeCursor, encodeCursor } from "../cursor"

describe("cursor", () => {
  it("round-trips", () => {
    const c = { k: "2026-11-14T12:00:00.000Z", id: "pat_1" }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })
  it("rejects garbage instead of throwing", () => {
    expect(decodeCursor("not-base64-json")).toBeNull()
    expect(decodeCursor(encodeCursor({ k: "x", id: "" }))).toBeNull()
  })
})
```

Create `src/lib/__tests__/app-error.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { AppError, appErrorAdapter, toAppError } from "../app-error"

describe("toAppError", () => {
  it("keeps AppError", () => {
    const e = new AppError("NOT_FOUND", "Patient not found.")
    expect(toAppError(e)).toBe(e)
  })
  it("maps zod issues to VALIDATION with field paths", () => {
    const r = z.object({ a: z.object({ b: z.string() }) }).safeParse({ a: { b: 1 } })
    const e = toAppError(r.error)
    expect(e.code).toBe("VALIDATION")
    expect(Object.keys(e.issues)).toEqual(["a.b"])
  })
  it("maps postgres unique violation to CONFLICT and trigger to INTERNAL", () => {
    expect(toAppError(Object.assign(new Error("dup"), { code: "23505" })).code).toBe("CONFLICT")
    expect(toAppError(Object.assign(new Error("append-only"), { code: "P0001" })).code).toBe("INTERNAL")
  })
  it("hides unknown error details", () => {
    const e = toAppError(new Error("connection refused 10.0.0.3"))
    expect(e.code).toBe("INTERNAL")
    expect(e.message).not.toContain("10.0.0.3")
  })
})

describe("appErrorAdapter", () => {
  it("round-trips code and issues", () => {
    const e = new AppError("VALIDATION", "Bad", { "identity.mrn": "Required" })
    const back = appErrorAdapter.fromSerializable(appErrorAdapter.toSerializable(e) as never)
    expect(back).toBeInstanceOf(AppError)
    expect(back.code).toBe("VALIDATION")
    expect(back.issues).toEqual({ "identity.mrn": "Required" })
  })
})
```

Run: `bunx vitest run src/lib`
Expected: FAIL (modules not found).

- [ ] **Step 2: Implement the cursor and error modules**

Create `src/lib/cursor.ts`:

```ts
import { z } from "zod"

/** Keyset position: k is the sort value as text, id breaks ties. */
export type Cursor = { k: string; id: string }
const cursorSchema = z.object({ k: z.string().max(400), id: z.string().min(1).max(64) })

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify(cursor))
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(fromBase64Url(value)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type Page<T> = { items: T[]; nextCursor: string | null }
```

Create `src/lib/app-error.ts`:

```ts
import { createSerializationAdapter } from "@tanstack/react-router"
import { ZodError } from "zod"

export const APP_ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "CLINICIAN_REQUIRED",
  "INTERNAL",
] as const
export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly issues: Record<string, string>
  constructor(code: AppErrorCode, message: string, issues: Record<string, string> = {}) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.issues = issues
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError

const pgCode = (e: unknown): string | undefined =>
  typeof e === "object" && e !== null && "code" in e && typeof e.code === "string"
    ? e.code
    : undefined

/** Server-side normaliser. Never leaks driver messages for unknown errors. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof ZodError) {
    const issues: Record<string, string> = {}
    for (const issue of error.issues) issues[issue.path.join(".")] ??= issue.message
    return new AppError("VALIDATION", "Some fields are invalid.", issues)
  }
  switch (pgCode(error)) {
    case "23505":
      return new AppError("CONFLICT", "A record with the same identifier already exists.")
    case "23503":
      return new AppError("CONFLICT", "A related record no longer exists. Reload and try again.")
    case "40001":
    case "40P01":
      return new AppError("CONFLICT", "Another change happened at the same time. Try again.")
  }
  console.error("[server] unexpected error:", error)
  return new AppError("INTERNAL", "Something went wrong on the server. Your data was not changed.")
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * Router's default error plugin keeps only `message`. This adapter (registered in
 * src/start.ts, ahead of the defaults) carries `code` and `issues` to the browser.
 */
export const appErrorAdapter = createSerializationAdapter({
  key: "hla/AppError",
  test: (value: unknown): value is AppError => value instanceof AppError,
  toSerializable: (e: AppError) => ({ code: e.code, message: e.message, issues: e.issues }),
  fromSerializable: (v: { code: AppErrorCode; message: string; issues: Record<string, string> }) =>
    new AppError(v.code, v.message, v.issues),
})
```

Run: `bunx vitest run src/lib`
Expected: PASS.

- [ ] **Step 3: Shared row types**

Create `src/domain/match-types.ts`:

```ts
import type {
  AuditAction as LegacyAuditAction,
  Criteria,
  Decision,
  Donor,
  EvaluationResult,
  Outcome,
  PairInputs,
  Patient,
} from "./schema"

export type AuditAction =
  | Exclude<LegacyAuditAction, "evaluation.created" | "evaluation.decided">
  | "match.checked"
  | "match.decided"
  | "match_run.queued"
  | "match_run.succeeded"
  | "match_run.failed"
  | "match_run.cancelled"

export const LEGACY_AUDIT_ACTION: Partial<Record<LegacyAuditAction, AuditAction>> = {
  "evaluation.created": "match.checked",
  "evaluation.decided": "match.decided",
}

export type PatientRow = {
  id: string
  version: number
  mrn: string
  fullName: string
  dateOfBirth: string
  listingState: Patient["listing"]["state"]
  listingDate: string
  urgencyStatus: Patient["listing"]["urgencyStatus"]
  abo: Patient["blood"]["abo"]
  device: string | null
  cpra: number | null
  updatedAt: string
}

export type DonorRow = {
  id: string
  version: number
  donorCode: string
  state: Donor["identity"]["state"]
  abo: Donor["blood"]["abo"]
  donationType: Donor["donation"]["type"]
  ageYears: number | null
  hospital: string
  updatedAt: string
}

export type Versioned<T> = { record: T; version: number }

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type RunTrigger = "donor.created" | "patient.created" | "manual" | "seed"

export type RunRow = {
  id: string
  trigger: RunTrigger
  subjectKind: "patient" | "donor"
  subjectId: string
  subjectLabel: string
  criteriaVersion: number
  status: RunStatus
  total: number | null
  processed: number
  passCount: number
  reviewCount: number
  failCount: number
  error: string | null
  cancelRequested: boolean
  createdBy: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type MatchRow = {
  id: string
  source: "screening" | "checked"
  runId: string | null
  patientId: string
  donorId: string
  patientName: string
  donorCode: string
  overall: Outcome
  blockerCount: number
  missingCount: number
  criteriaVersion: number
  decision: Decision["verdict"] | null
  /** Record or criteria changed since this result was computed. */
  outOfDate: boolean
  createdAt: string
}

export type MatchDetail = {
  id: string
  source: "screening" | "checked"
  runId: string | null
  createdAt: string
  createdBy: string
  patientId: string
  donorId: string
  patient: Patient
  donor: Donor
  criteriaVersionId: string
  criteriaVersion: number
  criteria: Criteria
  pair: PairInputs
  result: EvaluationResult
  decision: Decision | null
  outOfDate: boolean
}
```

In `src/domain/factories.ts`, extend the ID prefixes: `export type IdPrefix = "pat" | "don" | "evl" | "crv" | "aud" | "ab" | "va" | "run" | "mat" | "dec"`.

If `Outcome` is not exported from `src/domain/schema.ts` (check with `grep -n "export type Outcome" src/domain/schema.ts`), add `export type Outcome = z.infer<typeof outcome>` next to the `outcome` schema.

- [ ] **Step 4: SQL helpers, snapshots and audit**

Create `src/server/repos/sql.server.ts`:

```ts
import { sql } from "drizzle-orm"
import type { AnyColumn, SQL } from "drizzle-orm"
import { decodeCursor, encodeCursor } from "@/lib/cursor"
import type { Cursor, Page } from "@/lib/cursor"
import { AppError } from "@/lib/app-error"

/** Escapes LIKE wildcards; Postgres' default LIKE escape char is backslash. */
export const likeContains = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`

export function parseCursor(value: string | undefined): Cursor | null {
  if (!value) return null
  const cursor = decodeCursor(value)
  if (!cursor) throw new AppError("VALIDATION", "The page link is invalid. Start from the first page.")
  return cursor
}

/**
 * Row-value comparison matching ORDER BY (key dir, id dir), so Postgres can walk the
 * composite index. Timestamp keys travel as ISO text and are cast back, which is exact
 * because every timestamp is written with millisecond precision.
 */
export function after(
  key: SQL | AnyColumn,
  id: AnyColumn,
  cursor: Cursor,
  dir: "asc" | "desc",
  keyType: "text" | "timestamptz" = "text"
): SQL {
  const k = keyType === "timestamptz" ? sql`${cursor.k}::timestamptz` : sql`${cursor.k}`
  return dir === "desc"
    ? sql`(${key}, ${id}) < (${k}, ${cursor.id})`
    : sql`(${key}, ${id}) > (${k}, ${cursor.id})`
}

export function toPage<T>(rows: T[], limit: number, keyOf: (row: T) => Cursor): Page<T> {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(keyOf(last)) : null }
}
```

Create `src/server/repos/snapshots.server.ts`:

```ts
import { createHash } from "node:crypto"
import { recordSnapshots } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import type { Donor, Patient } from "@/domain/schema"

/** Deterministic JSON: object keys sorted recursively, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
}

export const snapshotHash = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex")

type SnapshotInput = { kind: "patient"; data: Patient } | { kind: "donor"; data: Donor }

/** Inserts each distinct record once. Returns hashes in input order. O(n) hashing, one statement. */
export async function putSnapshots(exec: Executor, items: SnapshotInput[]): Promise<string[]> {
  const hashes = items.map((item) => snapshotHash(item.data))
  const unique = new Map<string, SnapshotInput>()
  items.forEach((item, i) => unique.set(hashes[i], item))
  if (unique.size)
    await exec
      .insert(recordSnapshots)
      .values([...unique].map(([hash, item]) => ({ hash, kind: item.kind, data: item.data })))
      .onConflictDoNothing()
  return hashes
}
```

Create `src/server/repos/audit.server.ts`:

```ts
import { and, desc, eq } from "drizzle-orm"
import { auditLog } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { after, parseCursor, toPage } from "./sql.server"
import type { AuditAction } from "@/domain/match-types"
import { newId } from "@/domain/factories"
import type { Page } from "@/lib/cursor"

export type AuditInput = { actor: string; action: AuditAction; subjectId: string; summary: string; at?: Date }
export type AuditRow = { id: string; at: string; actor: string; action: string; subjectId: string; summary: string }

export async function appendAudit(exec: Executor, entry: AuditInput): Promise<void> {
  await exec.insert(auditLog).values({
    id: newId("aud"),
    at: entry.at ?? new Date(),
    actor: entry.actor || "Unspecified clinician",
    action: entry.action,
    subjectId: entry.subjectId,
    summary: entry.summary,
  })
}

export async function listAudit(
  exec: Executor,
  input: { action?: string; cursor?: string; limit?: number }
): Promise<Page<AuditRow>> {
  const limit = input.limit ?? 50
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select()
    .from(auditLog)
    .where(
      and(
        input.action ? eq(auditLog.action, input.action) : undefined,
        cursor ? after(auditLog.at, auditLog.id, cursor, "desc", "timestamptz") : undefined
      )
    )
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit + 1)
  const mapped = rows.map((r) => ({
    id: r.id, at: r.at.toISOString(), actor: r.actor, action: r.action, subjectId: r.subjectId, summary: r.summary,
  }))
  return toPage(mapped, limit, (r) => ({ k: r.at, id: r.id }))
}
```

The audit keyset orders by `(at, id)`, which matches `audit_at_id_idx` from Task 2.

- [ ] **Step 5: Write the failing records test**

Create `src/server/repos/__tests__/records.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { getPatient, insertPatient, listPatients, softDeletePatient, updatePatient, activePatients } from "../patients.server"
import { putSnapshots } from "../snapshots.server"
import { patient } from "@/domain/__tests__/builders"
import { AppError } from "@/lib/app-error"

describe("patients repository", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)
  const actor = "Dr Ada Okafor"

  it("inserts, reads and lists with summary columns only", async () => {
    const db = testDb()
    const p = patient({ id: "pat_a", identity: { firstName: "Maya", lastName: "Chen", mrn: "MRN-1" } })
    await insertPatient(db, p, actor)
    const got = await getPatient(db, "pat_a")
    expect(got.version).toBe(1)
    expect(got.record.identity.lastName).toBe("Chen")
    const page = await listPatients(db, { q: "chen" })
    expect(page.items.map((r) => r.fullName)).toEqual(["Maya Chen"])
    expect(page.items[0]).not.toHaveProperty("data")
  })

  it("rejects a stale version with CONFLICT", async () => {
    const db = testDb()
    const p = patient({ id: "pat_b" })
    await insertPatient(db, p, actor)
    await updatePatient(db, { ...p, notes: "one" }, 1, actor)
    await expect(updatePatient(db, { ...p, notes: "two" }, 1, actor)).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("soft-deletes: hidden from lists and candidate sets, NOT_FOUND on read", async () => {
    const db = testDb()
    await insertPatient(db, patient({ id: "pat_c", listing: { state: "active" } }), actor)
    await softDeletePatient(db, "pat_c", actor)
    expect((await listPatients(db, {})).items).toHaveLength(0)
    expect(await activePatients(db)).toHaveLength(0)
    await expect(getPatient(db, "pat_c")).rejects.toBeInstanceOf(AppError)
  })

  it("paginates by keyset without gaps or duplicates", async () => {
    const db = testDb()
    for (let i = 0; i < 7; i++) await insertPatient(db, patient({ id: `pat_${i}` }), actor)
    const seen: string[] = []
    let cursor: string | undefined
    do {
      const page = await listPatients(db, { cursor, limit: 3 })
      seen.push(...page.items.map((r) => r.id))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    expect(new Set(seen).size).toBe(7)
  })

  it("deduplicates snapshots by content", async () => {
    const db = testDb()
    const p = patient({ id: "pat_s" })
    const [a, b] = await putSnapshots(db, [{ kind: "patient", data: p }, { kind: "patient", data: structuredClone(p) }])
    expect(a).toBe(b)
  })
})
```

Run: `bun run test:db`
Expected: FAIL (`patients.server` not found).

- [ ] **Step 6: Implement the patient repository**

Create `src/server/repos/patients.server.ts`:

```ts
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { patients } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { after, likeContains, parseCursor, toPage } from "./sql.server"
import { snapshotHash } from "./snapshots.server"
import { patientSchema } from "@/domain/schema"
import type { Patient } from "@/domain/schema"
import type { PatientRow, Versioned } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type PatientSort = "updated" | "name" | "listed"
export type PatientListInput = {
  q?: string
  state?: Patient["listing"]["state"]
  abo?: NonNullable<Patient["blood"]["abo"]>
  urgency?: NonNullable<Patient["listing"]["urgencyStatus"]>
  sort?: PatientSort
  cursor?: string
  limit?: number
}

/** Summary columns derived from the record. Shared with the importer: one definition. */
export function patientCols(p: Patient) {
  return {
    mrn: p.identity.mrn,
    fullName: `${p.identity.firstName} ${p.identity.lastName}`.trim(),
    sortName: `${p.identity.lastName} ${p.identity.firstName}`.trim().toLowerCase(),
    dateOfBirth: p.identity.dateOfBirth,
    listingState: p.listing.state,
    listingDate: p.listing.listingDate,
    urgencyStatus: p.listing.urgencyStatus,
    abo: p.blood.abo,
    device: p.support.device ?? null,
    cpra: p.sensitization.cpra,
    contentHash: snapshotHash(p),
  }
}

const rowSelect = {
  id: patients.id, version: patients.version, mrn: patients.mrn, fullName: patients.fullName,
  dateOfBirth: patients.dateOfBirth, listingState: patients.listingState, listingDate: patients.listingDate,
  urgencyStatus: patients.urgencyStatus, abo: patients.abo, device: patients.device, cpra: patients.cpra,
  updatedAt: patients.updatedAt, sortName: patients.sortName,
}

export async function listPatients(exec: Executor, input: PatientListInput): Promise<Page<PatientRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const sort = input.sort ?? "updated"
  const cursor = parseCursor(input.cursor)
  const key =
    sort === "name" ? patients.sortName : sort === "listed" ? patients.listingDate : patients.updatedAt
  const keyType = sort === "updated" ? "timestamptz" : "text"
  const dir = sort === "name" ? "asc" : "desc"
  const order = dir === "asc" ? [asc(key), asc(patients.id)] : [desc(key), desc(patients.id)]
  const q = input.q?.trim()
  const rows = await exec
    .select(rowSelect)
    .from(patients)
    .where(
      and(
        isNull(patients.deletedAt),
        input.state ? eq(patients.listingState, input.state) : undefined,
        input.abo ? eq(patients.abo, input.abo) : undefined,
        input.urgency ? eq(patients.urgencyStatus, input.urgency) : undefined,
        q ? or(ilike(patients.fullName, likeContains(q)), ilike(patients.mrn, likeContains(q))) : undefined,
        cursor ? after(key, patients.id, cursor, dir, keyType) : undefined
      )
    )
    .orderBy(...order)
    .limit(limit + 1)
  const items = rows.map(({ sortName, updatedAt, ...r }) => ({
    ...r,
    updatedAt: updatedAt.toISOString(),
    _k: sort === "name" ? sortName : sort === "listed" ? r.listingDate : updatedAt.toISOString(),
  })) as Array<PatientRow & { _k: string }>
  const page = toPage(items, limit, (r) => ({ k: r._k, id: r.id }))
  return { ...page, items: page.items.map(({ _k: _, ...r }) => r) }
}

export async function getPatient(exec: Executor, id: string): Promise<Versioned<Patient>> {
  const [row] = await exec
    .select({ data: patients.data, version: patients.version })
    .from(patients)
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
  if (!row) throw new AppError("NOT_FOUND", "Patient not found. It may have been deleted.")
  return { record: row.data, version: row.version }
}

export async function insertPatient(exec: Executor, input: Patient, actor: string): Promise<Versioned<Patient>> {
  const now = new Date()
  const record = patientSchema.parse({ ...input, createdAt: now.toISOString(), updatedAt: now.toISOString() })
  await exec.insert(patients).values({
    id: record.id, version: 1, ...patientCols(record), data: record, createdAt: now, updatedAt: now,
  })
  await appendAudit(exec, { actor, action: "patient.created", subjectId: record.id, summary: "Created patient record", at: now })
  return { record, version: 1 }
}

export async function updatePatient(
  exec: Executor, input: Patient, expectedVersion: number, actor: string
): Promise<Versioned<Patient>> {
  const now = new Date()
  const record = patientSchema.parse({ ...input, updatedAt: now.toISOString() })
  const [row] = await exec
    .update(patients)
    .set({ ...patientCols(record), data: record, version: sql`${patients.version} + 1`, updatedAt: now })
    .where(and(eq(patients.id, record.id), eq(patients.version, expectedVersion), isNull(patients.deletedAt)))
    .returning({ version: patients.version })
  if (!row) {
    await getPatient(exec, record.id) // throws NOT_FOUND if gone
    throw new AppError("CONFLICT", "This patient changed since you opened it. Reload to see the latest version.")
  }
  await appendAudit(exec, { actor, action: "patient.updated", subjectId: record.id, summary: "Updated patient record", at: now })
  return { record, version: row.version }
}

export async function softDeletePatient(exec: Executor, id: string, actor: string): Promise<void> {
  const now = new Date()
  const [row] = await exec
    .update(patients)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
    .returning({ id: patients.id })
  if (!row) throw new AppError("NOT_FOUND", "Patient not found. It may have been deleted.")
  await appendAudit(exec, { actor, action: "patient.deleted", subjectId: id, summary: "Deleted patient; match results retained", at: now })
}

export async function activePatients(exec: Executor): Promise<Patient[]> {
  const rows = await exec
    .select({ data: patients.data })
    .from(patients)
    .where(and(eq(patients.listingState, "active"), isNull(patients.deletedAt)))
  return rows.map((r) => r.data)
}
```

Note: an `updated` cursor carries `updatedAt.toISOString()` and is cast back to `timestamptz`, so `(updated_at, id)` comparisons use `patients_updated_idx`. This is exact only because every timestamp comes from `new Date()` with millisecond precision (Global Constraints).

- [ ] **Step 7: Implement the donor repository**

Create `src/server/repos/donors.server.ts` with the same structure. These are the exact differences:

```ts
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { donors } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { after, likeContains, parseCursor, toPage } from "./sql.server"
import { snapshotHash } from "./snapshots.server"
import { donorSchema } from "@/domain/schema"
import type { Donor } from "@/domain/schema"
import type { DonorRow, Versioned } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type DonorSort = "updated" | "code"
export type DonorListInput = {
  q?: string
  state?: Donor["identity"]["state"]
  abo?: NonNullable<Donor["blood"]["abo"]>
  donationType?: Donor["donation"]["type"]
  sort?: DonorSort
  cursor?: string
  limit?: number
}

export function donorCols(d: Donor) {
  return {
    donorCode: d.identity.donorId,
    state: d.identity.state,
    abo: d.blood.abo,
    donationType: d.donation.type,
    ageYears: d.identity.ageYears === null ? null : Math.floor(d.identity.ageYears),
    hospital: d.identity.donorHospital,
    contentHash: snapshotHash(d),
  }
}

const rowSelect = {
  id: donors.id, version: donors.version, donorCode: donors.donorCode, state: donors.state, abo: donors.abo,
  donationType: donors.donationType, ageYears: donors.ageYears, hospital: donors.hospital, updatedAt: donors.updatedAt,
}

export async function listDonors(exec: Executor, input: DonorListInput): Promise<Page<DonorRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const sort = input.sort ?? "updated"
  const cursor = parseCursor(input.cursor)
  const key = sort === "code" ? donors.donorCode : donors.updatedAt
  const keyType = sort === "code" ? "text" : "timestamptz"
  const dir = sort === "code" ? "asc" : "desc"
  const q = input.q?.trim()
  const rows = await exec
    .select(rowSelect)
    .from(donors)
    .where(
      and(
        isNull(donors.deletedAt),
        input.state ? eq(donors.state, input.state) : undefined,
        input.abo ? eq(donors.abo, input.abo) : undefined,
        input.donationType ? eq(donors.donationType, input.donationType) : undefined,
        q ? or(ilike(donors.donorCode, likeContains(q)), ilike(donors.hospital, likeContains(q))) : undefined,
        cursor ? after(key, donors.id, cursor, dir, keyType) : undefined
      )
    )
    .orderBy(...(dir === "asc" ? [asc(key), asc(donors.id)] : [desc(key), desc(donors.id)]))
    .limit(limit + 1)
  const items = rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })) as DonorRow[]
  return toPage(items, limit, (r) => ({ k: sort === "code" ? r.donorCode : r.updatedAt, id: r.id }))
}

export async function getDonor(exec: Executor, id: string): Promise<Versioned<Donor>> {
  const [row] = await exec
    .select({ data: donors.data, version: donors.version })
    .from(donors)
    .where(and(eq(donors.id, id), isNull(donors.deletedAt)))
  if (!row) throw new AppError("NOT_FOUND", "Donor not found. It may have been deleted.")
  return { record: row.data, version: row.version }
}

export async function insertDonor(exec: Executor, input: Donor, actor: string): Promise<Versioned<Donor>> {
  const now = new Date()
  const record = donorSchema.parse({ ...input, createdAt: now.toISOString(), updatedAt: now.toISOString() })
  await exec.insert(donors).values({ id: record.id, version: 1, ...donorCols(record), data: record, createdAt: now, updatedAt: now })
  await appendAudit(exec, { actor, action: "donor.created", subjectId: record.id, summary: "Created donor record", at: now })
  return { record, version: 1 }
}

export async function updateDonor(exec: Executor, input: Donor, expectedVersion: number, actor: string): Promise<Versioned<Donor>> {
  const now = new Date()
  const record = donorSchema.parse({ ...input, updatedAt: now.toISOString() })
  const [row] = await exec
    .update(donors)
    .set({ ...donorCols(record), data: record, version: sql`${donors.version} + 1`, updatedAt: now })
    .where(and(eq(donors.id, record.id), eq(donors.version, expectedVersion), isNull(donors.deletedAt)))
    .returning({ version: donors.version })
  if (!row) {
    await getDonor(exec, record.id)
    throw new AppError("CONFLICT", "This donor changed since you opened it. Reload to see the latest version.")
  }
  await appendAudit(exec, { actor, action: "donor.updated", subjectId: record.id, summary: "Updated donor record", at: now })
  return { record, version: row.version }
}

export async function softDeleteDonor(exec: Executor, id: string, actor: string): Promise<void> {
  const now = new Date()
  const [row] = await exec
    .update(donors)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(donors.id, id), isNull(donors.deletedAt)))
    .returning({ id: donors.id })
  if (!row) throw new AppError("NOT_FOUND", "Donor not found. It may have been deleted.")
  await appendAudit(exec, { actor, action: "donor.deleted", subjectId: id, summary: "Deleted donor; match results retained", at: now })
}

export async function availableDonors(exec: Executor): Promise<Donor[]> {
  const rows = await exec
    .select({ data: donors.data })
    .from(donors)
    .where(and(eq(donors.state, "available"), isNull(donors.deletedAt)))
  return rows.map((r) => r.data)
}
```

Add a donor block to `records.db.test.ts` that mirrors the conflict and soft-delete tests (`insertDonor`, `updateDonor` with stale version → `CONFLICT`, `softDeleteDonor` → `availableDonors` empty), using the `donor()` builder from `src/domain/__tests__/builders.ts`.

- [ ] **Step 8: Run all tests**

Run: `bun run test && bun run test:db && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): cursor, AppError, snapshot, audit, patient and donor repositories"
```

---

### Task 4: Criteria and match-result repositories (check a pair, decide, out-of-date)

**Files:**
- Create: `src/server/repos/criteria.server.ts`, `src/server/repos/matches.server.ts`
- Test: `src/server/repos/__tests__/matches.db.test.ts`

**Interfaces:**
- Consumes: Task 3 repos, `putSnapshots`, `appendAudit`, `evaluate` (domain), `pairInputsSchema`, `decisionSchema`.
- Produces:
  - `ensureInitialCriteria(exec): Promise<void>`
  - `latestCriteria(exec): Promise<CriteriaVersion>`
  - `getCriteriaVersion(exec, id): Promise<CriteriaVersion>`
  - `listCriteriaVersions(exec): Promise<CriteriaVersion[]>`
  - `publishCriteria(exec, criteria: Criteria, changeNote: string, actor: string): Promise<CriteriaVersion>`
  - `checkPair(db: Db, input: { patientId: string; donorId: string; pair: PairInputs }, actor: string): Promise<{ id: string }>`
  - `decideMatch(db: Db, matchId: string, decision: Omit<Decision, "decidedAt">, actor: string): Promise<void>`
  - `getMatch(exec, id): Promise<MatchDetail>`
  - `listMatches(exec, input: MatchListInput): Promise<Page<MatchRow>>`
  - `MatchListInput = { overall?: Outcome; decision?: "pending" | "decided"; source?: "screening" | "checked"; patientId?: string; donorId?: string; runId?: string; from?: string; to?: string; order?: "recent" | "screen"; cursor?: string; limit?: number }`

- [ ] **Step 1: Write the failing test**

Create `src/server/repos/__tests__/matches.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { ensureInitialCriteria, latestCriteria, publishCriteria } from "../criteria.server"
import { checkPair, decideMatch, getMatch, listMatches } from "../matches.server"
import { insertPatient, updatePatient } from "../patients.server"
import { insertDonor as insertDonorRecord } from "../donors.server"
import { defaultPairInputs } from "@/domain/factories"
import { donor, patient } from "@/domain/__tests__/builders"

const actor = "Dr Ada Okafor"

async function seedPair() {
  const db = testDb()
  await ensureInitialCriteria(db)
  const p = patient({ id: "pat_1", listing: { state: "active" } })
  const d = donor({ id: "don_1", identity: { state: "available" } })
  await insertPatient(db, p, actor)
  await insertDonorRecord(db, d, actor)
  return { db, p, d }
}

describe("match results", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("recomputes on the server and stores a checked result with snapshots", async () => {
    const { db } = await seedPair()
    const { id } = await checkPair(db, { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() }, actor)
    const detail = await getMatch(db, id)
    expect(detail.source).toBe("checked")
    expect(detail.patient.id).toBe("pat_1")
    expect(detail.result.engineVersion).toBeTruthy()
    expect(detail.outOfDate).toBe(false)
  })

  it("marks results out of date after a record edit or a criteria publish", async () => {
    const { db, p } = await seedPair()
    const { id } = await checkPair(db, { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() }, actor)
    await updatePatient(db, { ...p, notes: "changed" }, 1, actor)
    expect((await getMatch(db, id)).outOfDate).toBe(true)
    const rows = await listMatches(db, {})
    expect(rows.items[0].outOfDate).toBe(true)
    const { id: id2 } = await checkPair(db, { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() }, actor)
    expect((await getMatch(db, id2)).outOfDate).toBe(false)
    await publishCriteria(db, (await latestCriteria(db)).criteria, "No-op republish", actor)
    expect((await getMatch(db, id2)).outOfDate).toBe(true)
  })

  it("enforces decision rules", async () => {
    const { db } = await seedPair()
    const { id } = await checkPair(db, { patientId: "pat_1", donorId: "don_1", pair: defaultPairInputs() }, actor)
    const base = { verdict: "accept" as const, reasons: [], clinician: "Dr Ada Okafor", rationale: "Reviewed", acknowledgedFindings: false }
    await expect(decideMatch(db, id, base, actor)).rejects.toMatchObject({ code: "VALIDATION" })
    await expect(decideMatch(db, id, { ...base, verdict: "decline" }, actor)).rejects.toMatchObject({ code: "VALIDATION" })
    await decideMatch(db, id, { ...base, acknowledgedFindings: true }, actor)
    await expect(decideMatch(db, id, { ...base, acknowledgedFindings: true }, actor)).rejects.toMatchObject({ code: "CONFLICT" })
    expect((await getMatch(db, id)).decision?.verdict).toBe("accept")
  })
})
```

Run: `bun run test:db`
Expected: FAIL (modules not found).

- [ ] **Step 2: Criteria repository**

Create `src/server/repos/criteria.server.ts`:

```ts
import { desc, eq } from "drizzle-orm"
import { criteriaVersions } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { DEFAULT_CRITERIA, validateCriteria } from "@/domain/criteria"
import { criteriaSchema } from "@/domain/schema"
import type { Criteria, CriteriaVersion } from "@/domain/schema"
import { newId } from "@/domain/factories"
import { AppError } from "@/lib/app-error"

type Row = typeof criteriaVersions.$inferSelect
const toVersion = (r: Row): CriteriaVersion => ({
  id: r.id, version: r.version, createdAt: r.createdAt.toISOString(), author: r.author, changeNote: r.changeNote, criteria: r.criteria,
})

export async function ensureInitialCriteria(exec: Executor): Promise<void> {
  await exec
    .insert(criteriaVersions)
    .values({ id: "criteria-v1", version: 1, author: "System", changeNote: "Initial default criteria", criteria: structuredClone(DEFAULT_CRITERIA), createdAt: new Date() })
    .onConflictDoNothing()
}

export async function latestCriteria(exec: Executor): Promise<CriteriaVersion> {
  const [row] = await exec.select().from(criteriaVersions).orderBy(desc(criteriaVersions.version)).limit(1)
  if (row) return toVersion(row)
  await ensureInitialCriteria(exec)
  return latestCriteria(exec)
}

export async function getCriteriaVersion(exec: Executor, id: string): Promise<CriteriaVersion> {
  const [row] = await exec.select().from(criteriaVersions).where(eq(criteriaVersions.id, id))
  if (!row) throw new AppError("NOT_FOUND", "Criteria version not found.")
  return toVersion(row)
}

export async function listCriteriaVersions(exec: Executor): Promise<CriteriaVersion[]> {
  const rows = await exec.select().from(criteriaVersions).orderBy(desc(criteriaVersions.version))
  return rows.map(toVersion)
}

/** Concurrent publishes race on UNIQUE(version); the loser gets CONFLICT via toAppError. */
export async function publishCriteria(exec: Executor, input: Criteria, changeNote: string, actor: string): Promise<CriteriaVersion> {
  const criteria = criteriaSchema.parse(input)
  const issues = validateCriteria(criteria)
  if (issues.length)
    throw new AppError("VALIDATION", "Criteria are inconsistent.", Object.fromEntries(issues.map((i) => [i.path, i.message])))
  const latest = await latestCriteria(exec)
  const now = new Date()
  const [row] = await exec
    .insert(criteriaVersions)
    .values({ id: newId("crv"), version: latest.version + 1, author: actor, changeNote, criteria, createdAt: now })
    .returning()
  await appendAudit(exec, { actor, action: "criteria.published", subjectId: row.id, summary: `Published criteria version ${row.version}`, at: now })
  return toVersion(row)
}
```

- [ ] **Step 3: Match repository**

Create `src/server/repos/matches.server.ts`:

```ts
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { criteriaVersions, decisions, donors, matchResults, patients, recordSnapshots } from "../db/schema.server"
import type { Db, Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { getCriteriaVersion, latestCriteria } from "./criteria.server"
import { getDonor } from "./donors.server"
import { getPatient } from "./patients.server"
import { putSnapshots } from "./snapshots.server"
import { after, parseCursor, toPage } from "./sql.server"
import { evaluate } from "@/domain/engine"
import { newId } from "@/domain/factories"
import { decisionSchema, pairInputsSchema } from "@/domain/schema"
import type { Decision, Donor, Outcome, PairInputs, Patient } from "@/domain/schema"
import type { MatchDetail, MatchRow } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export type MatchListInput = {
  overall?: Outcome
  decision?: "pending" | "decided"
  source?: "screening" | "checked"
  patientId?: string
  donorId?: string
  runId?: string
  /** Local calendar dates (YYYY-MM-DD), inclusive. */
  from?: string
  to?: string
  order?: "recent" | "screen"
  cursor?: string
  limit?: number
}

const latestCriteriaId = sql`(select id from ${criteriaVersions} order by version desc limit 1)`
const outOfDate = sql<boolean>`(
  ${patients.contentHash} <> ${matchResults.patientSnapshot}
  or ${donors.contentHash} <> ${matchResults.donorSnapshot}
  or ${matchResults.criteriaVersionId} <> ${latestCriteriaId}
)`
const screenKeyC = sql`${matchResults.screenKey} collate "C"`

export async function listMatches(exec: Executor, input: MatchListInput): Promise<Page<MatchRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const order = input.order ?? "recent"
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select({
      id: matchResults.id, source: matchResults.source, runId: matchResults.runId,
      patientId: matchResults.patientId, donorId: matchResults.donorId,
      patientName: matchResults.patientName, donorCode: matchResults.donorCode,
      overall: matchResults.overall, blockerCount: matchResults.blockerCount, missingCount: matchResults.missingCount,
      criteriaVersion: criteriaVersions.version, decision: decisions.verdict, outOfDate,
      createdAt: matchResults.createdAt, screenKey: matchResults.screenKey,
    })
    .from(matchResults)
    .innerJoin(patients, eq(patients.id, matchResults.patientId))
    .innerJoin(donors, eq(donors.id, matchResults.donorId))
    .innerJoin(criteriaVersions, eq(criteriaVersions.id, matchResults.criteriaVersionId))
    .leftJoin(decisions, eq(decisions.matchId, matchResults.id))
    .where(
      and(
        input.overall ? eq(matchResults.overall, input.overall) : undefined,
        input.source ? eq(matchResults.source, input.source) : undefined,
        input.decision === "pending" ? isNull(decisions.id) : input.decision === "decided" ? isNotNull(decisions.id) : undefined,
        input.patientId ? eq(matchResults.patientId, input.patientId) : undefined,
        input.donorId ? eq(matchResults.donorId, input.donorId) : undefined,
        input.runId ? eq(matchResults.runId, input.runId) : undefined,
        input.from ? gte(matchResults.createdAt, new Date(`${input.from}T00:00:00`)) : undefined,
        input.to ? lt(matchResults.createdAt, new Date(new Date(`${input.to}T00:00:00`).getTime() + 86_400_000)) : undefined,
        cursor
          ? order === "screen"
            ? after(screenKeyC, matchResults.id, cursor, "asc")
            : after(matchResults.createdAt, matchResults.id, cursor, "desc", "timestamptz")
          : undefined
      )
    )
    .orderBy(...(order === "screen" ? [asc(screenKeyC), asc(matchResults.id)] : [desc(matchResults.createdAt), desc(matchResults.id)]))
    .limit(limit + 1)
  const items = rows.map(({ createdAt, screenKey, ...r }) => ({ ...r, createdAt: createdAt.toISOString(), _k: order === "screen" ? (screenKey ?? "") : createdAt.toISOString() }))
  const page = toPage(items, limit, (r) => ({ k: r._k, id: r.id }))
  return { ...page, items: page.items.map(({ _k: _, ...r }) => r as MatchRow) }
}
```

`from`/`to` are interpreted in the **server's** local time zone. This matches v1 behaviour only when the server and browser share a zone, which is true for local use. The route sends dates as typed; spec §15 keeps multi-zone deployments out of scope.

Continue the same file:

```ts
const pSnap = alias(recordSnapshots, "p_snap")
const dSnap = alias(recordSnapshots, "d_snap")

export async function getMatch(exec: Executor, id: string): Promise<MatchDetail> {
  const [row] = await exec
    .select({ m: matchResults, patient: pSnap.data, donor: dSnap.data, decision: decisions, outOfDate })
    .from(matchResults)
    .innerJoin(pSnap, eq(pSnap.hash, matchResults.patientSnapshot))
    .innerJoin(dSnap, eq(dSnap.hash, matchResults.donorSnapshot))
    .innerJoin(patients, eq(patients.id, matchResults.patientId))
    .innerJoin(donors, eq(donors.id, matchResults.donorId))
    .leftJoin(decisions, eq(decisions.matchId, matchResults.id))
    .where(eq(matchResults.id, id))
  if (!row) throw new AppError("NOT_FOUND", "Match result not found.")
  const criteria = await getCriteriaVersion(exec, row.m.criteriaVersionId)
  return {
    id: row.m.id, source: row.m.source, runId: row.m.runId, createdAt: row.m.createdAt.toISOString(), createdBy: row.m.createdBy,
    patientId: row.m.patientId, donorId: row.m.donorId,
    patient: row.patient as Patient, donor: row.donor as Donor,
    criteriaVersionId: criteria.id, criteriaVersion: criteria.version, criteria: criteria.criteria,
    pair: row.m.pair, result: row.m.result,
    decision: row.decision
      ? { verdict: row.decision.verdict, reasons: row.decision.reasons, clinician: row.decision.clinician, rationale: row.decision.rationale, acknowledgedFindings: row.decision.acknowledgedFindings, decidedAt: row.decision.decidedAt.toISOString() }
      : null,
    outOfDate: row.outOfDate,
  }
}

export async function checkPair(
  db: Db, input: { patientId: string; donorId: string; pair: PairInputs }, actor: string
): Promise<{ id: string }> {
  const pair = pairInputsSchema.parse(input.pair)
  return db.transaction(async (tx) => {
    const [{ record: patient }, { record: donor }, criteria] = await Promise.all([
      getPatient(tx, input.patientId), getDonor(tx, input.donorId), latestCriteria(tx),
    ])
    const now = new Date()
    const result = evaluate({ patient, donor, pair, criteria: criteria.criteria, now })
    const [patientSnapshot, donorSnapshot] = await putSnapshots(tx, [
      { kind: "patient", data: patient }, { kind: "donor", data: donor },
    ])
    const id = newId("mat")
    await tx.insert(matchResults).values({
      id, runId: null, source: "checked", patientId: patient.id, donorId: donor.id,
      patientName: `${patient.identity.firstName} ${patient.identity.lastName}`.trim(), donorCode: donor.identity.donorId,
      patientSnapshot, donorSnapshot, criteriaVersionId: criteria.id, engineVersion: result.engineVersion,
      pair, result, overall: result.overall, blockerCount: result.blockers.length, missingCount: result.missingCount,
      screenKey: null, createdBy: actor, createdAt: now,
    })
    await appendAudit(tx, { actor, action: "match.checked", subjectId: id, summary: `Checked ${donor.identity.donorId} for ${patient.identity.mrn}`, at: now })
    return { id }
  })
}
```

The three reads inside the transaction share one connection, so `Promise.all` there gives no parallelism. node-postgres queues queries per client, so it is correct but not faster. Keep it for brevity.

```ts
export async function decideMatch(
  db: Db, matchId: string, input: Omit<Decision, "decidedAt">, actor: string
): Promise<void> {
  const now = new Date()
  const decision = decisionSchema.parse({ ...input, clinician: input.clinician.trim(), rationale: input.rationale.trim(), decidedAt: now.toISOString() })
  if (decision.verdict === "decline" && decision.reasons.length === 0)
    throw new AppError("VALIDATION", "Select at least one decline reason.", { reasons: "Select at least one decline reason." })
  await db.transaction(async (tx) => {
    const [m] = await tx
      .select({ source: matchResults.source, result: matchResults.result })
      .from(matchResults)
      .where(eq(matchResults.id, matchId))
      .for("share")
    if (!m) throw new AppError("NOT_FOUND", "Match result not found.")
    if (m.source !== "checked")
      throw new AppError("VALIDATION", "Complete this match with pair inputs before recording a decision.")
    const findings = [...m.result.blockers, ...m.result.rules.flatMap((r) => r.findings)]
    const needsAck = m.result.overall !== "pass" || findings.some((f) => f.status === "fail" || f.status === "review")
    if (needsAck && !decision.acknowledgedFindings)
      throw new AppError("VALIDATION", "Acknowledge all FAIL and REVIEW findings before recording a decision.", { acknowledgedFindings: "Required" })
    const inserted = await tx
      .insert(decisions)
      .values({ id: newId("dec"), matchId, ...decision, decidedAt: now })
      .onConflictDoNothing({ target: decisions.matchId })
      .returning({ id: decisions.id })
    if (!inserted.length) throw new AppError("CONFLICT", "This match result already has a final decision.")
    await appendAudit(tx, { actor, action: "match.decided", subjectId: matchId, summary: `Recorded ${decision.verdict} decision`, at: now })
  })
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test:db && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): criteria and match result repositories with server-side recompute and decision guards"
```

---

### Task 5: Match runs: screening key, outbox, worker, reaper

Implements spec §5.

**Files:**
- Modify: `src/domain/engine.ts` (extract `screenRow`, `isPediatricDonor`)
- Create: `src/domain/screen-key.ts`, `src/domain/__tests__/screen-key.test.ts`
- Create: `src/server/repos/runs.server.ts`, `src/server/services/records.server.ts`, `src/server/matching/process-run.server.ts`, `src/worker/main.ts`
- Modify: `package.json` (scripts)
- Test: `src/server/matching/__tests__/runs.db.test.ts`

**Interfaces:**
- Produces:
  - `screenRow(donor: Donor, patient: Patient, criteria: Criteria, now: Date): ScreenRow`
  - `isPediatricDonor(donor: Donor): boolean`
  - `donorScreenKey(row: ScreenRow, pediatricDonor: boolean): string`
  - `patientScreenKey(overall: Outcome, donorId: string): string`
  - runs repo: `enqueueRun(exec, input: EnqueueInput): Promise<string>`, `claimNextRun(exec): Promise<string | null>`, `requestCancel(exec, runId, actor): Promise<RunStatus>`, `reapStaleRuns(exec, now?: Date): Promise<number>`, `finishRun(exec, runId, status: "succeeded" | "failed" | "cancelled", error: string | null, actor?: string): Promise<void>`, `releaseRun(exec, runId)`, `failOrRequeue(exec, runId, error: unknown)`, `listActiveRuns(exec): Promise<RunRow[]>`, `listRunHistory(exec, input: RunHistoryInput): Promise<Page<RunRow>>`, `getRun(exec, id): Promise<RunRow>`
  - services: `createPatientWithRun(db, patient, actor): Promise<{ patient: Versioned<Patient>; runId: string }>`, `createDonorWithRun(db, donor, actor)`, `rerunForPatient(db, id, actor): Promise<{ runId: string }>`, `rerunForDonor(db, id, actor)`
  - `processRun(db: Db, runId: string, opts?: ProcessOptions): Promise<RunStatus>`

- [ ] **Step 1: Extract `screenRow` from `screenDonor`**

In `src/domain/engine.ts`, move the body of the `.map((patient) => …)` callback into an exported function, and add `isPediatricDonor`:

```ts
export function isPediatricDonor(donor: Donor): boolean {
  return donor.identity.ageYears !== null && donor.identity.ageYears < 18
}

export function screenRow(donor: Donor, patient: Patient, criteria: Criteria, now: Date): ScreenRow {
  const duration = daysAtStatus(patient, now)
  return {
    patient,
    result: evaluate({ patient, donor, criteria, pair: defaultPairInputs(), now }),
    aboPriority:
      donor.blood.abo === null || patient.blood.abo === null
        ? "incompatible"
        : aboPriority(donor.blood.abo, patient.blood.abo),
    isPediatricCandidate: isPediatricCandidate(patient, now),
    daysAtStatus: duration.days,
    daysAtStatusFromListing: duration.fromListing,
  }
}
```

In `screenDonor`, use `.map((patient) => screenRow(donor, patient, criteria, now))` and `const pediatricDonor = isPediatricDonor(donor)`.

Run: `bun run test`
Expected: PASS (behaviour unchanged).

- [ ] **Step 2: Write the failing screening-key test**

Create `src/domain/__tests__/screen-key.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { isPediatricDonor, screenDonor, screenRow } from "../engine"
import { URGENCY_STATUS_VALUES, ABO_VALUES } from "../options"
import { donorScreenKey } from "../screen-key"
import { donor, patient } from "./builders"

const now = new Date("2026-11-14T12:00:00Z")

/** Deterministic pseudo-random cohort covering urgency, ABO, dates and pediatric ages. */
function cohort(n: number) {
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  return Array.from({ length: n }, (_, i) =>
    patient({
      id: `pat_${String(i).padStart(3, "0")}`,
      identity: { dateOfBirth: rnd() < 0.2 ? "2018-03-01" : "1975-06-15" },
      listing: {
        state: "active",
        urgencyStatus: rnd() < 0.1 ? null : URGENCY_STATUS_VALUES[Math.floor(rnd() * URGENCY_STATUS_VALUES.length)],
        statusDate: rnd() < 0.15 ? "" : `2026-${String(1 + Math.floor(rnd() * 10)).padStart(2, "0")}-15`,
        listingDate: rnd() < 0.1 ? "" : "2025-12-01",
      },
      blood: { abo: rnd() < 0.05 ? null : ABO_VALUES[Math.floor(rnd() * ABO_VALUES.length)] },
    })
  )
}

describe("donorScreenKey", () => {
  for (const age of [34, 12]) {
    it(`sorts byte-wise exactly like screenDonor (donor age ${age})`, () => {
      const d = donor({ identity: { ageYears: age, state: "available" }, blood: { abo: "O" } })
      const patients = cohort(120)
      const expected = screenDonor(d, patients, DEFAULT_CRITERIA, now).map((r) => r.patient.id)
      const keyed = patients
        .map((p) => ({ id: p.id, key: donorScreenKey(screenRow(d, p, DEFAULT_CRITERIA, now), isPediatricDonor(d)) }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map((r) => r.id)
      expect(keyed).toEqual(expected)
    })
  }
})
```

Run: `bunx vitest run src/domain/__tests__/screen-key.test.ts`
Expected: FAIL (`screen-key` not found).

- [ ] **Step 3: Implement the key**

First confirm the urgency range: `grep -n "URGENCY_RANK" -A12 src/domain/options.ts`. Every value must be an integer from 0 to 98; 99 is reserved for "not recorded".

Create `src/domain/screen-key.ts`:

```ts
import type { ScreenRow } from "./engine"
import { URGENCY_RANK } from "./options"
import type { Outcome } from "./schema"

const OUTCOME: Record<Outcome, number> = { pass: 0, review: 1, fail: 2 }
const BLOOD: Record<ScreenRow["aboPriority"], number> = { primary: 0, secondary: 1, incompatible: 2 }
const DAYS_MAX = 9_999_998
const pad = (n: number, width: number) => String(n).padStart(width, "0")

/**
 * Fixed-width string whose byte order (COLLATE "C") equals screenDonor's comparator:
 * outcome, urgency (unrecorded last), pediatric-first for pediatric donors, ABO priority,
 * days at status descending (unknown last), then patient id. Not OPTN allocation.
 */
export function donorScreenKey(row: ScreenRow, pediatricDonor: boolean): string {
  const status = row.patient.listing.urgencyStatus
  const urgency = status === null ? 99 : URGENCY_RANK[status]
  const pediatric = pediatricDonor ? (row.isPediatricCandidate ? 0 : 1) : 0
  const days = row.daysAtStatus === null ? DAYS_MAX + 1 : DAYS_MAX - Math.min(row.daysAtStatus, DAYS_MAX)
  return `${OUTCOME[row.result.overall]}${pad(urgency, 2)}${pediatric}${BLOOD[row.aboPriority]}${pad(days, 7)}|${row.patient.id}`
}

/** Patient-subject runs: best outcome first, then donor id. */
export function patientScreenKey(overall: Outcome, donorId: string): string {
  return `${OUTCOME[overall]}|${donorId}`
}
```

Run: `bunx vitest run src/domain/__tests__/screen-key.test.ts`
Expected: PASS for both donor ages.

- [ ] **Step 4: Runs repository**

Create `src/server/repos/runs.server.ts`:

```ts
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { criteriaVersions, matchResults, matchRuns } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { latestCriteria } from "./criteria.server"
import { after, parseCursor, toPage } from "./sql.server"
import { newId } from "@/domain/factories"
import type { RunRow, RunStatus, RunTrigger } from "@/domain/match-types"
import { AppError } from "@/lib/app-error"
import type { Page } from "@/lib/cursor"

export const MAX_ATTEMPTS = 3
export const STALE_AFTER_MS = 60_000
export const NOTIFY_CHANNEL = "match_runs"

export type EnqueueInput = {
  subjectKind: "patient" | "donor"
  subjectId: string
  subjectLabel: string
  trigger: RunTrigger
  actor: string
}

/** Call inside the same transaction that writes the subject (transactional outbox). */
export async function enqueueRun(exec: Executor, input: EnqueueInput): Promise<string> {
  const criteria = await latestCriteria(exec)
  const id = newId("run")
  const now = new Date()
  await exec.insert(matchRuns).values({
    id, trigger: input.trigger, subjectKind: input.subjectKind, subjectId: input.subjectId, subjectLabel: input.subjectLabel,
    criteriaVersionId: criteria.id, status: "queued", createdBy: input.actor, createdAt: now,
  })
  await appendAudit(exec, { actor: input.actor, action: "match_run.queued", subjectId: id, summary: `Queued matching for ${input.subjectLabel}`, at: now })
  // Delivered on COMMIT only; a rollback never wakes the worker.
  await exec.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${id})`)
  return id
}

/** Atomic claim; safe with any number of workers. */
export async function claimNextRun(exec: Executor): Promise<string | null> {
  const now = new Date()
  const result = await exec.execute<{ id: string }>(sql`
    update ${matchRuns}
       set status = 'running', started_at = coalesce(started_at, ${now}), heartbeat_at = ${now}, attempts = attempts + 1
     where id = (
       select id from ${matchRuns}
        where status = 'queued'
        order by created_at, id
        for update skip locked
        limit 1)
    returning id`)
  return result.rows[0]?.id ?? null
}

export async function finishRun(
  exec: Executor, runId: string, status: "succeeded" | "failed" | "cancelled", error: string | null, actor = "System"
): Promise<void> {
  const now = new Date()
  const counts = (o: string) => sql`(select count(*)::int from ${matchResults} where run_id = ${runId} and overall = ${o})`
  const [row] = await exec
    .update(matchRuns)
    .set({
      status, error, finishedAt: now,
      passCount: counts("pass"), reviewCount: counts("review"), failCount: counts("fail"),
      processed: sql`(select count(*)::int from ${matchResults} where run_id = ${runId})`,
    })
    .where(and(eq(matchRuns.id, runId), inArray(matchRuns.status, ["queued", "running"])))
    .returning({ label: matchRuns.subjectLabel })
  if (row)
    await appendAudit(exec, {
      actor, action: `match_run.${status}`, subjectId: runId,
      summary: `Matching ${status} for ${row.label}${error ? `: ${error}` : ""}`, at: now,
    })
}

/** Graceful shutdown: hand the run back without spending an attempt. */
export async function releaseRun(exec: Executor, runId: string): Promise<void> {
  await exec.execute(sql`update ${matchRuns} set status = 'queued', attempts = greatest(attempts - 1, 0) where id = ${runId} and status = 'running'`)
  await exec.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${runId})`)
}

export async function failOrRequeue(exec: Executor, runId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown worker error"
  const [run] = await exec.select({ attempts: matchRuns.attempts }).from(matchRuns).where(eq(matchRuns.id, runId))
  if (!run) return
  if (run.attempts >= MAX_ATTEMPTS) await finishRun(exec, runId, "failed", message)
  else {
    await exec.update(matchRuns).set({ status: "queued", error: message }).where(and(eq(matchRuns.id, runId), eq(matchRuns.status, "running")))
    await exec.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${runId})`)
  }
}

/** Runs whose worker died. Requeue until MAX_ATTEMPTS, then fail. Returns rows touched. */
export async function reapStaleRuns(exec: Executor, now = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
  const result = await exec.execute<{ id: string; status: string }>(sql`
    update ${matchRuns}
       set status = case when attempts >= ${MAX_ATTEMPTS} then 'failed' else 'queued' end,
           error = case when attempts >= ${MAX_ATTEMPTS} then 'The worker stopped responding repeatedly.' else error end,
           finished_at = case when attempts >= ${MAX_ATTEMPTS} then ${now} else null end
     where status = 'running' and heartbeat_at < ${staleBefore}
    returning id, status`)
  for (const row of result.rows) {
    if (row.status === "queued") await exec.execute(sql`select pg_notify(${NOTIFY_CHANNEL}, ${row.id})`)
    else await appendAudit(exec, { actor: "System", action: "match_run.failed", subjectId: row.id, summary: "Matching failed: worker stopped responding", at: now })
  }
  return result.rows.length
}

export async function requestCancel(exec: Executor, runId: string, actor: string): Promise<RunStatus> {
  const now = new Date()
  const result = await exec.execute<{ status: RunStatus; label: string }>(sql`
    update ${matchRuns}
       set cancel_requested = true,
           status = case when status = 'queued' then 'cancelled' else status end,
           finished_at = case when status = 'queued' then ${now} else finished_at end
     where id = ${runId} and status in ('queued', 'running')
    returning status, subject_label as label`)
  const row = result.rows[0]
  if (!row) {
    await getRun(exec, runId) // NOT_FOUND if missing
    throw new AppError("CONFLICT", "This run has already finished.")
  }
  if (row.status === "cancelled")
    await appendAudit(exec, { actor, action: "match_run.cancelled", subjectId: runId, summary: `Cancelled matching for ${row.label}`, at: now })
  return row.status
}

const runSelect = {
  id: matchRuns.id, trigger: matchRuns.trigger, subjectKind: matchRuns.subjectKind, subjectId: matchRuns.subjectId,
  subjectLabel: matchRuns.subjectLabel, criteriaVersion: criteriaVersions.version, status: matchRuns.status,
  total: matchRuns.total, processed: matchRuns.processed, passCount: matchRuns.passCount, reviewCount: matchRuns.reviewCount,
  failCount: matchRuns.failCount, error: matchRuns.error, cancelRequested: matchRuns.cancelRequested, createdBy: matchRuns.createdBy,
  createdAt: matchRuns.createdAt, startedAt: matchRuns.startedAt, finishedAt: matchRuns.finishedAt,
}
type RawRun = { createdAt: Date; startedAt: Date | null; finishedAt: Date | null } & Omit<RunRow, "createdAt" | "startedAt" | "finishedAt">
const toRunRow = (r: RawRun): RunRow => ({
  ...r, createdAt: r.createdAt.toISOString(), startedAt: r.startedAt?.toISOString() ?? null, finishedAt: r.finishedAt?.toISOString() ?? null,
})

export async function listActiveRuns(exec: Executor): Promise<RunRow[]> {
  const rows = await exec
    .select(runSelect)
    .from(matchRuns)
    .innerJoin(criteriaVersions, eq(criteriaVersions.id, matchRuns.criteriaVersionId))
    .where(inArray(matchRuns.status, ["queued", "running"]))
    .orderBy(matchRuns.createdAt)
  return rows.map(toRunRow)
}

export type RunHistoryInput = { status?: RunStatus; subjectKind?: "patient" | "donor"; subjectId?: string; cursor?: string; limit?: number }

export async function listRunHistory(exec: Executor, input: RunHistoryInput): Promise<Page<RunRow>> {
  const limit = Math.min(input.limit ?? 50, 200)
  const cursor = parseCursor(input.cursor)
  const rows = await exec
    .select(runSelect)
    .from(matchRuns)
    .innerJoin(criteriaVersions, eq(criteriaVersions.id, matchRuns.criteriaVersionId))
    .where(
      and(
        input.status ? eq(matchRuns.status, input.status) : undefined,
        input.subjectKind ? eq(matchRuns.subjectKind, input.subjectKind) : undefined,
        input.subjectId ? eq(matchRuns.subjectId, input.subjectId) : undefined,
        cursor ? after(matchRuns.createdAt, matchRuns.id, cursor, "desc", "timestamptz") : undefined
      )
    )
    .orderBy(desc(matchRuns.createdAt), desc(matchRuns.id))
    .limit(limit + 1)
  return toPage(rows.map(toRunRow), limit, (r) => ({ k: r.createdAt, id: r.id }))
}

export async function getRun(exec: Executor, id: string): Promise<RunRow> {
  const [row] = await exec
    .select(runSelect)
    .from(matchRuns)
    .innerJoin(criteriaVersions, eq(criteriaVersions.id, matchRuns.criteriaVersionId))
    .where(eq(matchRuns.id, id))
  if (!row) throw new AppError("NOT_FOUND", "Match run not found.")
  return toRunRow(row)
}
```

- [ ] **Step 5: Services: create with run (outbox), rerun**

Create `src/server/services/records.server.ts`:

```ts
import type { Db } from "../db/client.server"
import { enqueueRun } from "../repos/runs.server"
import { getDonor, insertDonor } from "../repos/donors.server"
import { getPatient, insertPatient } from "../repos/patients.server"
import type { Donor, Patient } from "@/domain/schema"
import type { Versioned } from "@/domain/match-types"

const patientLabel = (p: Patient) => `${p.identity.firstName} ${p.identity.lastName} (${p.identity.mrn})`
const donorLabel = (d: Donor) => d.identity.donorId

export async function createPatientWithRun(db: Db, input: Patient, actor: string) {
  return db.transaction(async (tx) => {
    const patient: Versioned<Patient> = await insertPatient(tx, input, actor)
    const runId = await enqueueRun(tx, { subjectKind: "patient", subjectId: patient.record.id, subjectLabel: patientLabel(patient.record), trigger: "patient.created", actor })
    return { patient, runId }
  })
}

export async function createDonorWithRun(db: Db, input: Donor, actor: string) {
  return db.transaction(async (tx) => {
    const donor: Versioned<Donor> = await insertDonor(tx, input, actor)
    const runId = await enqueueRun(tx, { subjectKind: "donor", subjectId: donor.record.id, subjectLabel: donorLabel(donor.record), trigger: "donor.created", actor })
    return { donor, runId }
  })
}

export async function rerunForPatient(db: Db, id: string, actor: string) {
  return db.transaction(async (tx) => {
    const { record } = await getPatient(tx, id)
    return { runId: await enqueueRun(tx, { subjectKind: "patient", subjectId: id, subjectLabel: patientLabel(record), trigger: "manual", actor }) }
  })
}

export async function rerunForDonor(db: Db, id: string, actor: string) {
  return db.transaction(async (tx) => {
    const { record } = await getDonor(tx, id)
    return { runId: await enqueueRun(tx, { subjectKind: "donor", subjectId: id, subjectLabel: donorLabel(record), trigger: "manual", actor }) }
  })
}
```

- [ ] **Step 6: Run processor**

Create `src/server/matching/process-run.server.ts`:

```ts
import { and, eq, sql } from "drizzle-orm"
import { matchResults, matchRuns } from "../db/schema.server"
import type { Db } from "../db/client.server"
import { getCriteriaVersion } from "../repos/criteria.server"
import { activePatients, getPatient } from "../repos/patients.server"
import { availableDonors, getDonor } from "../repos/donors.server"
import { finishRun, releaseRun } from "../repos/runs.server"
import { putSnapshots } from "../repos/snapshots.server"
import { evaluate, isPediatricDonor, screenRow } from "@/domain/engine"
import { defaultPairInputs, newId } from "@/domain/factories"
import { donorScreenKey, patientScreenKey } from "@/domain/screen-key"
import type { Donor, EvaluationResult, Patient } from "@/domain/schema"
import type { RunStatus } from "@/domain/match-types"
import { isAppError } from "@/lib/app-error"

export type ProcessOptions = {
  chunkSize?: number
  now?: Date
  /** Checked between chunks; true → release the run back to the queue. */
  shouldStop?: () => boolean
  /** Test hook: runs after each committed chunk (throw to simulate a crash). */
  afterChunk?: (chunkIndex: number) => void
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const nameOf = (p: Patient) => `${p.identity.firstName} ${p.identity.lastName}`.trim()

export async function processRun(db: Db, runId: string, opts: ProcessOptions = {}): Promise<RunStatus> {
  const chunkSize = opts.chunkSize ?? 50
  const now = opts.now ?? new Date() // one clock per run: ages and durations are consistent
  const [run] = await db.select().from(matchRuns).where(eq(matchRuns.id, runId))
  if (!run || run.status !== "running") return run?.status ?? "failed"
  const criteria = await getCriteriaVersion(db, run.criteriaVersionId)

  let subject: Patient | Donor
  try {
    subject = run.subjectKind === "donor" ? (await getDonor(db, run.subjectId)).record : (await getPatient(db, run.subjectId)).record
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") {
      await finishRun(db, runId, "cancelled", "The record was deleted before matching finished.")
      return "cancelled"
    }
    throw error
  }

  // Sorted by id so a resumed run walks the same chunks; the unique index skips done pairs.
  const counterparts: Array<Patient | Donor> =
    run.subjectKind === "donor" ? (await activePatients(db)).sort(byId) : (await availableDonors(db)).sort(byId)
  const [subjectHash] = await putSnapshots(db, [
    run.subjectKind === "donor" ? { kind: "donor", data: subject as Donor } : { kind: "patient", data: subject as Patient },
  ])
  await db.update(matchRuns).set({ total: counterparts.length, heartbeatAt: new Date() }).where(eq(matchRuns.id, runId))
  const pediatricDonor = run.subjectKind === "donor" && isPediatricDonor(subject as Donor)
  const pair = defaultPairInputs()

  for (let start = 0, chunkIndex = 0; start < counterparts.length; start += chunkSize, chunkIndex++) {
    const [state] = await db.select({ cancel: matchRuns.cancelRequested, status: matchRuns.status }).from(matchRuns).where(eq(matchRuns.id, runId))
    if (!state || state.status !== "running") return state?.status ?? "failed"
    if (state.cancel) {
      await finishRun(db, runId, "cancelled", null)
      return "cancelled"
    }
    if (opts.shouldStop?.()) {
      await releaseRun(db, runId)
      return "queued"
    }

    const chunk = counterparts.slice(start, start + chunkSize)
    const computed = chunk.map((other) => {
      const patient = (run.subjectKind === "donor" ? other : subject) as Patient
      const donor = (run.subjectKind === "donor" ? subject : other) as Donor
      let result: EvaluationResult, screenKey: string
      if (run.subjectKind === "donor") {
        const row = screenRow(donor, patient, criteria.criteria, now)
        result = row.result
        screenKey = donorScreenKey(row, pediatricDonor)
      } else {
        result = evaluate({ patient, donor, pair, criteria: criteria.criteria, now })
        screenKey = patientScreenKey(result.overall, donor.id)
      }
      return { patient, donor, result, screenKey }
    })

    await db.transaction(async (tx) => {
      const hashes = await putSnapshots(
        tx,
        chunk.map((c) => (run.subjectKind === "donor" ? { kind: "patient" as const, data: c as Patient } : { kind: "donor" as const, data: c as Donor }))
      )
      const createdAt = new Date()
      const inserted = await tx
        .insert(matchResults)
        .values(
          computed.map((c, i) => ({
            id: newId("mat"), runId, source: "screening" as const,
            patientId: c.patient.id, donorId: c.donor.id, patientName: nameOf(c.patient), donorCode: c.donor.identity.donorId,
            patientSnapshot: run.subjectKind === "donor" ? hashes[i] : subjectHash,
            donorSnapshot: run.subjectKind === "donor" ? subjectHash : hashes[i],
            criteriaVersionId: criteria.id, engineVersion: c.result.engineVersion, pair,
            result: c.result, overall: c.result.overall, blockerCount: c.result.blockers.length, missingCount: c.result.missingCount,
            screenKey: c.screenKey, createdBy: run.createdBy, createdAt,
          }))
        )
        .onConflictDoNothing()
        .returning({ overall: matchResults.overall })
      const n = (o: string) => inserted.filter((r) => r.overall === o).length
      await tx
        .update(matchRuns)
        .set({
          processed: start + chunk.length,
          passCount: sql`${matchRuns.passCount} + ${n("pass")}`,
          reviewCount: sql`${matchRuns.reviewCount} + ${n("review")}`,
          failCount: sql`${matchRuns.failCount} + ${n("fail")}`,
          heartbeatAt: new Date(),
        })
        .where(and(eq(matchRuns.id, runId), eq(matchRuns.status, "running")))
    })
    opts.afterChunk?.(chunkIndex)
  }

  await finishRun(db, runId, "succeeded", null)
  return "succeeded"
}
```

The counters only increase by the rows actually inserted (`RETURNING` skips conflicts), so a replayed chunk adds nothing. `finishRun` then recomputes all counts from `match_results` as the final source of truth.

- [ ] **Step 7: Write the failing run tests**

Create `src/server/matching/__tests__/runs.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { count, eq } from "drizzle-orm"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { matchResults, matchRuns } from "../../db/schema.server"
import { ensureInitialCriteria } from "../../repos/criteria.server"
import { insertPatient } from "../../repos/patients.server"
import { insertDonor, softDeleteDonor } from "../../repos/donors.server"
import { claimNextRun, enqueueRun, getRun, reapStaleRuns, requestCancel } from "../../repos/runs.server"
import { createDonorWithRun } from "../../services/records.server"
import { listMatches } from "../../repos/matches.server"
import { processRun } from "../process-run.server"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { screenDonor } from "@/domain/engine"
import { donor, patient } from "@/domain/__tests__/builders"

const actor = "Dr Ada Okafor"
const now = new Date("2026-11-14T12:00:00Z")

async function setup(activeCount: number) {
  const db = testDb()
  await ensureInitialCriteria(db)
  const ps = Array.from({ length: activeCount }, (_, i) =>
    patient({ id: `pat_${i}`, listing: { state: "active", urgencyStatus: i % 2 ? "A1" : "A3" } })
  )
  for (const p of ps) await insertPatient(db, p, actor)
  await insertPatient(db, patient({ id: "pat_inactive", listing: { state: "inactive" } }), actor)
  const d = donor({ id: "don_1", identity: { state: "available", ageYears: 30 } })
  const { runId } = await createDonorWithRun(db, d, actor)
  return { db, ps, d, runId }
}

describe("match runs", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("outbox: rolling back the record also rolls back the run", async () => {
    const db = testDb()
    await ensureInitialCriteria(db)
    await db
      .transaction(async (tx) => {
        await insertDonor(tx, donor({ id: "don_x" }), actor)
        await enqueueRun(tx, { subjectKind: "donor", subjectId: "don_x", subjectLabel: "X", trigger: "donor.created", actor })
        throw new Error("boom")
      })
      .catch(() => undefined)
    const [{ n }] = await db.select({ n: count() }).from(matchRuns)
    expect(n).toBe(0)
  })

  it("processes a donor run over active patients only, in screening order", async () => {
    const { db, ps, d, runId } = await setup(7)
    expect(await claimNextRun(db)).toBe(runId)
    expect(await processRun(db, runId, { chunkSize: 3, now })).toBe("succeeded")
    const run = await getRun(db, runId)
    expect(run).toMatchObject({ status: "succeeded", total: 7, processed: 7 })
    expect(run.passCount + run.reviewCount + run.failCount).toBe(7)
    const page = await listMatches(db, { runId, order: "screen" })
    const expected = screenDonor(d, ps, DEFAULT_CRITERIA, now).map((r) => r.patient.id)
    expect(page.items.map((r) => r.patientId)).toEqual(expected)
  })

  it("two concurrent claims never take the same run", async () => {
    const { db, runId } = await setup(1)
    const claims = await Promise.all([claimNextRun(db), claimNextRun(db)])
    expect(claims.filter(Boolean)).toEqual([runId])
  })

  it("recovers from a crash mid-run without duplicates or double counts", async () => {
    const { db, runId } = await setup(5)
    await claimNextRun(db)
    await expect(
      processRun(db, runId, { chunkSize: 2, now, afterChunk: () => { throw new Error("crash") } })
    ).rejects.toThrow("crash")
    await db.update(matchRuns).set({ heartbeatAt: new Date(Date.now() - 120_000) }).where(eq(matchRuns.id, runId))
    expect(await reapStaleRuns(db)).toBe(1)
    expect(await claimNextRun(db)).toBe(runId)
    expect(await processRun(db, runId, { chunkSize: 2, now })).toBe("succeeded")
    const [{ n }] = await db.select({ n: count() }).from(matchResults).where(eq(matchResults.runId, runId))
    expect(n).toBe(5)
    const run = await getRun(db, runId)
    expect(run.passCount + run.reviewCount + run.failCount).toBe(5)
  })

  it("cancels queued runs immediately and running runs between chunks", async () => {
    const { db, runId } = await setup(4)
    expect(await requestCancel(db, runId, actor)).toBe("cancelled")
    await expect(requestCancel(db, runId, actor)).rejects.toMatchObject({ code: "CONFLICT" })

    const { runId: run2 } = await createDonorWithRun(db, donor({ id: "don_2", identity: { state: "available" } }), actor)
    await claimNextRun(db)
    await requestCancel(db, run2, actor)
    expect(await processRun(db, run2, { chunkSize: 1, now })).toBe("cancelled")
  })

  it("cancels when the subject was deleted before processing", async () => {
    const { db, runId } = await setup(2)
    await softDeleteDonor(db, "don_1", actor)
    await claimNextRun(db)
    expect(await processRun(db, runId, { now })).toBe("cancelled")
  })

  it("fails after MAX_ATTEMPTS stale heartbeats", async () => {
    const { db, runId } = await setup(1)
    for (let i = 0; i < 3; i++) {
      await claimNextRun(db)
      await db.update(matchRuns).set({ heartbeatAt: new Date(Date.now() - 120_000) }).where(eq(matchRuns.id, runId))
      await reapStaleRuns(db)
    }
    expect((await getRun(db, runId)).status).toBe("failed")
  })
})
```

Run: `bun run test:db`
Expected: FAIL until Steps 4–6 compile, then PASS. Run once more after Step 8.

- [ ] **Step 8: Worker process**

Create `src/worker/main.ts`:

```ts
import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"
import { processRun } from "@/server/matching/process-run.server"
import { claimNextRun, failOrRequeue, NOTIFY_CHANNEL, reapStaleRuns } from "@/server/repos/runs.server"

const POLL_MS = 5_000
const REAP_MS = 30_000

const { pool, db } = createDb(env().DATABASE_URL, { max: 4, statementTimeoutMs: 30_000 })
if (process.env.NODE_ENV !== "production") await runMigrations(db)

let stopping = false
let wake: (() => void) | null = null
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(() => { wake = null; resolve() }, ms)
    wake = () => { clearTimeout(timer); wake = null; resolve() }
  })

const listener = await pool.connect()
listener.on("notification", () => wake?.())
listener.on("error", (error) => {
  // Lost the LISTEN connection: exit so the supervisor (bun --watch / systemd) restarts cleanly.
  console.error("[worker] listener error:", error.message)
  process.exit(1)
})
await listener.query(`LISTEN ${NOTIFY_CHANNEL}`)

const reaper = setInterval(() => {
  reapStaleRuns(db).then(
    (n) => n && console.info(`[worker] reaped ${n} stale run(s)`),
    (e: unknown) => console.error("[worker] reaper failed:", e)
  )
}, REAP_MS)

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => { stopping = true; wake?.() })

console.info("[worker] ready")
while (!stopping) {
  let id: string | null
  while (!stopping && (id = await claimNextRun(db))) {
    const started = performance.now()
    try {
      const status = await processRun(db, id, { shouldStop: () => stopping })
      console.info(`[worker] ${id} ${status} in ${Math.round(performance.now() - started)} ms`)
    } catch (error) {
      console.error(`[worker] ${id} failed:`, error)
      await failOrRequeue(db, id, error)
    }
  }
  if (!stopping) await sleep(POLL_MS)
}

clearInterval(reaper)
listener.release()
await pool.end()
console.info("[worker] stopped")
```

Add these scripts to `package.json`, and add `concurrently` as a dev dependency (`bun add --exact -d concurrently@10.0.7`):

```json
"worker": "NODE_ENV=production bun src/worker/main.ts",
"dev:web": "vite dev --port 3000",
"dev:worker": "bun --watch src/worker/main.ts",
"dev": "concurrently -k -n web,worker -c blue,magenta \"bun run dev:web\" \"bun run dev:worker\""
```

- [ ] **Step 9: Verify end to end**

Run: `bun run test && bun run test:db && bun run typecheck && bun run lint`
Expected: PASS.

Run: `bun run db:migrate && bun run dev:worker`
Expected: logs `[worker] ready`. Press Ctrl-C.
Expected: logs `[worker] stopped` within 1 s.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(matching): postgres job queue, screening key, run processor and worker"
```

---

## Phase 2: API layer and data flow

### Task 6: Start + Query wiring, SSR, cookies, middleware, server functions, query options, mutations

**Files:**
- Modify: `src/start.ts`, `vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`
- Create: `src/lib/query-client.ts`, `src/lib/prefs.ts`, `src/lib/route-helpers.ts`, `src/features/shared/middleware.ts`
- Create: `src/server/repos/dashboard.server.ts`
- Create, per feature, `*.functions.ts`, `*.queries.ts` and `*.mutations.ts` under `src/features/{patients,donors,matches,matching,criteria,audit,dashboard}/`
- Test: `src/lib/__tests__/prefs.test.ts`

**Interfaces:**
- Produces:
  - `RouterContext = { queryClient: QueryClient; prefs: Prefs }` (`prefs` is added by the root `beforeLoad`)
  - `Prefs = { theme: "light" | "dark"; clinician: string }`, `readPrefs()`, `writePrefCookie(name, value)`, `THEME_COOKIE`, `CLINICIAN_COOKIE`
  - `ensureOrNotFound<T>(p: Promise<T>): Promise<T>`
  - key factories: `patientKeys`, `donorKeys`, `matchKeys`, `matchingKeys`, `criteriaKeys`, `auditKeys`, `dashboardKeys`
  - query factories: `patientQueries.{list,detail}`, `donorQueries.{list,detail}`, `matchQueries.{list,detail}`, `matchingQueries.{active,history,detail}`, `criteriaQueries.{latest,versions}`, `auditQueries.list`, `dashboardQueries.summary`
  - mutation hooks: `useCreatePatient`, `useUpdatePatient`, `useDeletePatient`, `useRerunPatient`, the same four for donors, `useCheckPair`, `useDecideMatch`, `useCancelRun`, `usePublishCriteria`
  - search schemas (zod, all fields optional): `patientListSearch`, `donorListSearch`, `matchListSearch`, `runHistorySearch`, `auditSearch`

- [ ] **Step 1: Prefs test (failing)**

Create `src/lib/__tests__/prefs.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { parsePrefs } from "../prefs"

describe("parsePrefs", () => {
  it("defaults safely", () => {
    expect(parsePrefs(() => undefined)).toEqual({ theme: "light", clinician: "" })
  })
  it("reads values and clamps the clinician name", () => {
    const jar: Record<string, string> = { hla_theme: "dark", hla_clinician: `  ${"x".repeat(300)}  ` }
    const prefs = parsePrefs((n) => jar[n])
    expect(prefs.theme).toBe("dark")
    expect(prefs.clinician).toHaveLength(200)
  })
  it("ignores unknown theme values", () => {
    expect(parsePrefs(() => "purple").theme).toBe("light")
  })
})
```

Run: `bunx vitest run src/lib/__tests__/prefs.test.ts`
Expected: FAIL.

- [ ] **Step 2: Prefs, query client and route helpers**

Create `src/lib/prefs.ts`:

```ts
import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

export const THEME_COOKIE = "hla_theme"
export const CLINICIAN_COOKIE = "hla_clinician"
export type Theme = "light" | "dark"
export type Prefs = { theme: Theme; clinician: string }

/** `get` returns already-decoded cookie values. */
export function parsePrefs(get: (name: string) => string | undefined): Prefs {
  return {
    theme: get(THEME_COOKIE) === "dark" ? "dark" : "light",
    clinician: (get(CLINICIAN_COOKIE) ?? "").trim().slice(0, 200),
  }
}

function documentCookie(name: string): string | undefined {
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=")
    if (eq > 0 && part.slice(0, eq) === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** Server: request cookies (h3 decodes). Client: document.cookie. Runs in the root beforeLoad. */
export const readPrefs = createIsomorphicFn()
  .server((): Prefs => parsePrefs(getCookie))
  .client((): Prefs => parsePrefs(documentCookie))

export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}
```

Create `src/lib/query-client.ts`:

```ts
import { MutationCache, QueryClient } from "@tanstack/react-query"
import { errorMessage, isAppError } from "./app-error"
import { toast } from "@/components/ui/toast"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorTitle?: string; silent?: boolean }
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        // Domain errors (404, validation) never succeed on retry.
        retry: (failureCount, error) => !isAppError(error) && failureCount < 1,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 0 },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (mutation.meta?.silent || typeof window === "undefined") return
        toast.add({
          type: "error",
          title: mutation.meta?.errorTitle ?? "Action failed",
          description: errorMessage(error, "The change was not saved."),
        })
      },
    }),
  })
}
```

Create `src/lib/route-helpers.ts`:

```ts
import { notFound } from "@tanstack/react-router"
import { isAppError } from "./app-error"

/** Loader helper: a NOT_FOUND AppError becomes the router's notFound(). */
export async function ensureOrNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") throw notFound()
    throw error
  }
}
```

Run: `bunx vitest run src/lib`
Expected: PASS.

- [ ] **Step 3: Start config, Vite, router, root**

Replace `src/start.ts`:

```ts
import { createStart } from "@tanstack/react-start"
import { appErrorAdapter } from "@/lib/app-error"

/** SSR is on: loaders prefetch through TanStack Query and dehydrate into the HTML. */
export const startInstance = createStart(() => ({
  serializationAdapters: [appErrorAdapter],
}))
```

In `vite.config.ts`, replace `tanstackStart({ spa: { enabled: true } })` with `tanstackStart()`.

Replace `src/router.tsx`:

```tsx
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import type { QueryClient } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import { createQueryClient } from "@/lib/query-client"
import type { Prefs } from "@/lib/prefs"
import { PagePending } from "@/components/app/page-skeletons"
import { RouteError, NotFound } from "@/components/app/route-error"

export type RouterContext = { queryClient: QueryClient; prefs?: Prefs }

/** Called once per SSR request and once in the browser: never share a QueryClient across users. */
export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Query owns freshness; the router always asks it.
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPendingComponent: PagePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

Task 8 creates `PagePending`, `RouteError` and `NotFound`. To keep this task compiling, create minimal versions now:

```tsx
// src/components/app/page-skeletons.tsx
import { Skeleton } from "@/components/ui/skeleton"
export function PagePending() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
```

```tsx
// src/components/app/route-error.tsx
import type { ErrorComponentProps } from "@tanstack/react-router"
export function RouteError({ error }: ErrorComponentProps) {
  return <p role="alert">{error.message}</p>
}
export function NotFound() {
  return <p>Not found.</p>
}
```

Replace `src/routes/__root.tsx`:

```tsx
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import appCss from "../styles.css?url"
import type { RouterContext } from "@/router"
import { readPrefs } from "@/lib/prefs"
import { AppShell } from "@/components/app/app-shell"
import { NotFound } from "@/components/app/route-error"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"

export const Route = createRootRouteWithContext<RouterContext>()({
  // Cookie parse only: microseconds on the client, so it is fine on every navigation.
  beforeLoad: () => ({ prefs: readPrefs() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HLA-Trans" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  return (
    <TooltipProvider>
      <Toaster>
        <AppShell>
          <Outlet />
        </AppShell>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
              { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
            ]}
          />
        )}
      </Toaster>
    </TooltipProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { prefs } = Route.useRouteContext()
  return (
    <html lang="en" className={prefs.theme === "dark" ? "dark" : undefined} style={{ colorScheme: prefs.theme }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Middleware**

Create `src/features/shared/middleware.ts`:

```ts
import { createMiddleware } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { isNotFound, isRedirect } from "@tanstack/react-router"
import { AppError, toAppError } from "@/lib/app-error"
import { CLINICIAN_COOKIE } from "@/lib/prefs"

/** Outermost: every thrown value leaves the server as a typed AppError (or router control flow). */
export const errorMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) throw error
    throw toAppError(error)
  }
})

export const actorMiddleware = createMiddleware({ type: "function" })
  .middleware([errorMiddleware])
  .server(async ({ next }) => {
    const actor = (getCookie(CLINICIAN_COOKIE) ?? "").trim().slice(0, 200)
    return next({ context: { actor } })
  })

/** Writes are attributed. Without a name the UI prompts (CLINICIAN_REQUIRED). */
export const writeMiddleware = createMiddleware({ type: "function" })
  .middleware([actorMiddleware])
  .server(async ({ next, context }) => {
    if (!context.actor)
      throw new AppError("CLINICIAN_REQUIRED", "Enter your name in the header before saving changes.")
    return next()
  })
```

- [ ] **Step 5: Patients feature (the template for every feature)**

Create `src/features/patients/patients.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { ABO_VALUES, CANDIDATE_STATE_VALUES, URGENCY_STATUS_VALUES } from "@/domain/options"
import { patientSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import { getPatient, listPatients, softDeletePatient, updatePatient } from "@/server/repos/patients.server"
import { createPatientWithRun, rerunForPatient } from "@/server/services/records.server"

export const patientListSearch = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  state: z.enum(CANDIDATE_STATE_VALUES).optional().catch(undefined),
  abo: z.enum(ABO_VALUES).optional().catch(undefined),
  urgency: z.enum(URGENCY_STATUS_VALUES).optional().catch(undefined),
  sort: z.enum(["updated", "name", "listed"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type PatientListSearch = z.infer<typeof patientListSearch>
const idInput = z.object({ id: z.string().min(1).max(64) })

export const listPatientsFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(patientListSearch)
  .handler(({ data }) => listPatients(getDb(), data))

export const getPatientFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .validator(idInput)
  .handler(({ data }) => getPatient(getDb(), data.id))

export const createPatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(patientSchema)
  .handler(({ data, context }) => createPatientWithRun(getDb(), data, context.actor))

export const updatePatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ patient: patientSchema, expectedVersion: z.number().int().min(1) }))
  .handler(({ data, context }) => updatePatient(getDb(), data.patient, data.expectedVersion, context.actor))

export const deletePatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) => softDeletePatient(getDb(), data.id, context.actor))

export const rerunPatientFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(idInput)
  .handler(({ data, context }) => rerunForPatient(getDb(), data.id, context.actor))
```

Create `src/features/patients/patients.queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import { getPatientFn, listPatientsFn } from "./patients.functions"
import type { PatientListSearch } from "./patients.functions"

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (search: PatientListSearch) => [...patientKeys.lists(), search] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
}

export const patientQueries = {
  list: (search: PatientListSearch) =>
    queryOptions({ queryKey: patientKeys.list(search), queryFn: () => listPatientsFn({ data: search }) }),
  detail: (id: string) =>
    queryOptions({ queryKey: patientKeys.detail(id), queryFn: () => getPatientFn({ data: { id } }) }),
}
```

Create `src/features/patients/patients.mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPatientFn, deletePatientFn, rerunPatientFn, updatePatientFn } from "./patients.functions"
import { patientKeys } from "./patients.queries"
import { matchingKeys } from "@/features/matching/matching.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"
import type { Patient } from "@/domain/schema"

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "create"],
    meta: { errorTitle: "Patient not saved" },
    mutationFn: (patient: Patient) => createPatientFn({ data: patient }),
    onSuccess: ({ patient }) => {
      qc.setQueryData(patientKeys.detail(patient.record.id), patient)
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      void qc.invalidateQueries({ queryKey: matchingKeys.all })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "update"],
    meta: { errorTitle: "Patient not saved" },
    mutationFn: (input: { patient: Patient; expectedVersion: number }) => updatePatientFn({ data: input }),
    onSuccess: (saved) => {
      qc.setQueryData(patientKeys.detail(saved.record.id), saved)
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      // Results for this patient are now "out of date".
      void qc.invalidateQueries({ queryKey: matchKeys.all })
    },
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "delete"],
    meta: { errorTitle: "Patient not deleted" },
    mutationFn: (id: string) => deletePatientFn({ data: { id } }),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: patientKeys.detail(id) })
      void qc.invalidateQueries({ queryKey: patientKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useRerunPatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["patients", "rerun"],
    meta: { errorTitle: "Matching not started" },
    mutationFn: (id: string) => rerunPatientFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: matchingKeys.all }),
  })
}
```

- [ ] **Step 6: Donors feature**

Create the three donor files from the patient template with these exact substitutions:

| Patients | Donors |
|---|---|
| `patientListSearch` fields `state: CANDIDATE_STATE_VALUES`, `abo`, `urgency`, `sort: ["updated","name","listed"]` | `donorListSearch` fields `q`, `state: z.enum(DONOR_STATE_VALUES)`, `abo: z.enum(ABO_VALUES)`, `donationType: z.enum(DONATION_TYPE_VALUES)`, `sort: z.enum(["updated","code"])`, `cursor` (each `.optional().catch(undefined)`) |
| `patientSchema` | `donorSchema` |
| repos `listPatients/getPatient/updatePatient/softDeletePatient` | `listDonors/getDonor/updateDonor/softDeleteDonor` |
| services `createPatientWithRun/rerunForPatient` | `createDonorWithRun/rerunForDonor` |
| `patientKeys`, `patientQueries`, `use*Patient` | `donorKeys` (`["donors", …]`), `donorQueries`, `useCreateDonor`, `useUpdateDonor`, `useDeleteDonor`, `useRerunDonor` |
| `createPatientFn` result `{ patient, runId }` | `{ donor, runId }` |
| `errorTitle: "Patient not saved"` | `"Donor not saved"` (and the matching delete/rerun titles) |

- [ ] **Step 7: Matches, matching, criteria, audit, dashboard**

Create `src/server/repos/dashboard.server.ts`:

```ts
import { and, count, eq, isNull } from "drizzle-orm"
import { decisions, donors, matchResults, patients } from "../db/schema.server"
import type { Executor } from "../db/client.server"
import { listMatches } from "./matches.server"
import type { MatchRow } from "@/domain/match-types"

export type DashboardSummary = {
  activePatients: number
  availableDonors: number
  pendingDecisions: number
  recent: MatchRow[]
  pending: MatchRow[]
}

export async function dashboardSummary(exec: Executor): Promise<DashboardSummary> {
  const [[a], [b], [c], recent, pending] = await Promise.all([
    exec.select({ n: count() }).from(patients).where(and(eq(patients.listingState, "active"), isNull(patients.deletedAt))),
    exec.select({ n: count() }).from(donors).where(and(eq(donors.state, "available"), isNull(donors.deletedAt))),
    exec.select({ n: count() }).from(matchResults).leftJoin(decisions, eq(decisions.matchId, matchResults.id))
      .where(and(eq(matchResults.source, "checked"), isNull(decisions.id))),
    listMatches(exec, { limit: 8 }),
    listMatches(exec, { source: "checked", decision: "pending", limit: 8 }),
  ])
  return { activePatients: a.n, availableDonors: b.n, pendingDecisions: c.n, recent: recent.items, pending: pending.items }
}
```

On the pool-backed `db`, `Promise.all` runs these five queries on separate connections in parallel.

Create `src/features/matches/matches.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { decisionSchema, pairInputsSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import { checkPair, decideMatch, getMatch, listMatches } from "@/server/repos/matches.server"

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const matchListSearch = z.object({
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  decision: z.enum(["pending", "decided"]).optional().catch(undefined),
  source: z.enum(["screening", "checked"]).optional().catch(undefined),
  patientId: z.string().max(64).optional().catch(undefined),
  donorId: z.string().max(64).optional().catch(undefined),
  runId: z.string().max(64).optional().catch(undefined),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  order: z.enum(["recent", "screen"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type MatchListSearch = z.infer<typeof matchListSearch>

export const listMatchesFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware]).validator(matchListSearch)
  .handler(({ data }) => listMatches(getDb(), data))

export const getMatchFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware]).validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(({ data }) => getMatch(getDb(), data.id))

export const checkPairFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ patientId: z.string().min(1).max(64), donorId: z.string().min(1).max(64), pair: pairInputsSchema }))
  .handler(({ data, context }) => checkPair(getDb(), data, context.actor))

export const decideMatchFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ matchId: z.string().min(1).max(64), decision: decisionSchema.omit({ decidedAt: true }) }))
  .handler(({ data, context }) => decideMatch(getDb(), data.matchId, data.decision, context.actor))
```

Create `src/features/matches/matches.queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import { getMatchFn, listMatchesFn } from "./matches.functions"
import type { MatchListSearch } from "./matches.functions"

export const matchKeys = {
  all: ["matches"] as const,
  lists: () => [...matchKeys.all, "list"] as const,
  list: (search: MatchListSearch) => [...matchKeys.lists(), search] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
}
export const matchQueries = {
  list: (search: MatchListSearch) => queryOptions({ queryKey: matchKeys.list(search), queryFn: () => listMatchesFn({ data: search }) }),
  // Saved results are immutable except for decision and out-of-date flags: long staleTime.
  detail: (id: string) => queryOptions({ queryKey: matchKeys.detail(id), queryFn: () => getMatchFn({ data: { id } }), staleTime: 60_000 }),
}
```

Create `src/features/matches/matches.mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { checkPairFn, decideMatchFn } from "./matches.functions"
import { matchKeys } from "./matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"
import type { Decision, PairInputs } from "@/domain/schema"

export function useCheckPair() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matches", "check"],
    meta: { errorTitle: "Match result not saved" },
    mutationFn: (input: { patientId: string; donorId: string; pair: PairInputs }) => checkPairFn({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: matchKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

/** Not optimistic: a clinical decision is shown only after the server accepts it. */
export function useDecideMatch(matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matches", "decide", matchId],
    meta: { errorTitle: "Decision not recorded" },
    mutationFn: (decision: Omit<Decision, "decidedAt">) => decideMatchFn({ data: { matchId, decision } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
      void qc.invalidateQueries({ queryKey: matchKeys.lists() })
      void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
```

Create `src/features/matching/matching.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { getRun, listActiveRuns, listRunHistory, requestCancel } from "@/server/repos/runs.server"

export const runHistorySearch = z.object({
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional().catch(undefined),
  subjectKind: z.enum(["patient", "donor"]).optional().catch(undefined),
  subjectId: z.string().max(64).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type RunHistorySearch = z.infer<typeof runHistorySearch>
const idInput = z.object({ id: z.string().min(1).max(64) })

export const activeRunsFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).handler(() => listActiveRuns(getDb()))
export const runHistoryFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).validator(runHistorySearch)
  .handler(({ data }) => listRunHistory(getDb(), data))
export const getRunFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).validator(idInput)
  .handler(({ data }) => getRun(getDb(), data.id))
export const cancelRunFn = createServerFn({ method: "POST" }).middleware([writeMiddleware]).validator(idInput)
  .handler(({ data, context }) => requestCancel(getDb(), data.id, context.actor))
```

Create `src/features/matching/matching.queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"
import { activeRunsFn, getRunFn, runHistoryFn } from "./matching.functions"
import type { RunHistorySearch } from "./matching.functions"
import type { RunRow } from "@/domain/match-types"

export const matchingKeys = {
  all: ["matching"] as const,
  active: () => [...matchingKeys.all, "active"] as const,
  history: (search: RunHistorySearch) => [...matchingKeys.all, "history", search] as const,
  detail: (id: string) => [...matchingKeys.all, "run", id] as const,
}

const isLive = (r: RunRow) => r.status === "queued" || r.status === "running"

export const matchingQueries = {
  /** Spec §5.5: 1 s while anything runs, 15 s idle (catches runs started elsewhere), never when hidden. */
  active: () =>
    queryOptions({
      queryKey: matchingKeys.active(),
      queryFn: () => activeRunsFn(),
      staleTime: 0,
      refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 1_000 : 15_000),
      refetchIntervalInBackground: false,
    }),
  history: (search: RunHistorySearch) =>
    queryOptions({ queryKey: matchingKeys.history(search), queryFn: () => runHistoryFn({ data: search }) }),
  detail: (id: string) =>
    queryOptions({
      queryKey: matchingKeys.detail(id),
      queryFn: () => getRunFn({ data: { id } }),
      refetchInterval: (query) => (query.state.data && isLive(query.state.data) ? 1_000 : false),
    }),
}
```

Create `src/features/matching/matching.mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cancelRunFn } from "./matching.functions"
import { matchingKeys } from "./matching.queries"

export function useCancelRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["matching", "cancel"],
    meta: { errorTitle: "Run not cancelled" },
    mutationFn: (id: string) => cancelRunFn({ data: { id } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: matchingKeys.all }),
  })
}
```

Create `src/features/criteria/criteria.functions.ts`, `criteria.queries.ts` and `criteria.mutations.ts`:

```ts
// criteria.functions.ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { criteriaSchema } from "@/domain/schema"
import { getDb } from "@/server/db/client.server"
import { latestCriteria, listCriteriaVersions, publishCriteria } from "@/server/repos/criteria.server"

export const latestCriteriaFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).handler(() => latestCriteria(getDb()))
export const criteriaVersionsFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).handler(() => listCriteriaVersions(getDb()))
export const publishCriteriaFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ criteria: criteriaSchema, changeNote: z.string().trim().min(1, "Describe the change.").max(4000) }))
  .handler(({ data, context }) => getDb().transaction((tx) => publishCriteria(tx, data.criteria, data.changeNote, context.actor)))
```

```ts
// criteria.queries.ts
import { queryOptions } from "@tanstack/react-query"
import { criteriaVersionsFn, latestCriteriaFn } from "./criteria.functions"

export const criteriaKeys = {
  all: ["criteria"] as const,
  latest: () => [...criteriaKeys.all, "latest"] as const,
  versions: () => [...criteriaKeys.all, "versions"] as const,
}
export const criteriaQueries = {
  latest: () => queryOptions({ queryKey: criteriaKeys.latest(), queryFn: () => latestCriteriaFn() }),
  versions: () => queryOptions({ queryKey: criteriaKeys.versions(), queryFn: () => criteriaVersionsFn() }),
}
```

```ts
// criteria.mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { publishCriteriaFn } from "./criteria.functions"
import { criteriaKeys } from "./criteria.queries"
import { matchKeys } from "@/features/matches/matches.queries"
import type { Criteria } from "@/domain/schema"

export function usePublishCriteria() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["criteria", "publish"],
    meta: { errorTitle: "Criteria not published" },
    mutationFn: (input: { criteria: Criteria; changeNote: string }) => publishCriteriaFn({ data: input }),
    onSuccess: (version) => {
      qc.setQueryData(criteriaKeys.latest(), version)
      void qc.invalidateQueries({ queryKey: criteriaKeys.versions() })
      void qc.invalidateQueries({ queryKey: matchKeys.all }) // every result is now out of date
    },
  })
}
```

Create `src/features/audit/audit.functions.ts` and `audit.queries.ts`:

```ts
// audit.functions.ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { listAudit } from "@/server/repos/audit.server"

export const auditSearch = z.object({
  action: z.string().max(40).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})
export type AuditSearch = z.infer<typeof auditSearch>
export const listAuditFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).validator(auditSearch)
  .handler(({ data }) => listAudit(getDb(), data))
```

```ts
// audit.queries.ts
import { queryOptions } from "@tanstack/react-query"
import { listAuditFn } from "./audit.functions"
import type { AuditSearch } from "./audit.functions"

export const auditKeys = { all: ["audit"] as const, list: (s: AuditSearch) => [...auditKeys.all, s] as const }
export const auditQueries = {
  list: (s: AuditSearch) => queryOptions({ queryKey: auditKeys.list(s), queryFn: () => listAuditFn({ data: s }) }),
}
```

Create `src/features/dashboard/dashboard.functions.ts` and `dashboard.queries.ts`:

```ts
// dashboard.functions.ts
import { createServerFn } from "@tanstack/react-start"
import { errorMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { dashboardSummary } from "@/server/repos/dashboard.server"

export const dashboardFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).handler(() => dashboardSummary(getDb()))
```

```ts
// dashboard.queries.ts
import { queryOptions } from "@tanstack/react-query"
import { dashboardFn } from "./dashboard.functions"

export const dashboardKeys = { all: ["dashboard"] as const }
export const dashboardQueries = {
  summary: () => queryOptions({ queryKey: dashboardKeys.all, queryFn: () => dashboardFn() }),
}
```

- [ ] **Step 8: Verify the server boundary and error transport**

Run: `bun run typecheck && bun run lint && bun run test && bun run build`
Expected: PASS, and the build prints no import-protection violations.

Run: `grep -rlE "drizzle-orm|from \"pg\"|node-postgres" dist/client .output/public 2>/dev/null | head`
Expected: no output. (Start writes client assets to `dist/client` or `.output/public` depending on the target; check both.)

Error transport check:
1. Run `bun run dev`.
2. In the browser console on any page, run: `document.cookie = "hla_clinician=; Max-Age=0; Path=/"`.
3. Trigger any write. Before Task 7 there is none, so call `createPatientFn` from a temporary button, or wait until Task 7 Step 9.

Expected: the error toast says "Enter your name in the header…", and `error.code === "CLINICIAN_REQUIRED"` on the client. If `code` is missing, the adapter was not applied. Check that `src/start.ts` is the file Start loads (it exports `startInstance`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(api): tanstack query + ssr integration, typed errors, middleware, server functions and query options"
```

---

### Task 7: Move every route to loaders + queries; data, import and reset; remove localStorage storage

**Files:**
- Move: `src/lib/storage/validated-db-schema.ts` → `src/domain/backup-schema.ts` (export `validatedDbSchema` unchanged)
- Delete: `src/lib/storage/db.ts`, `src/lib/storage/local-store.ts`, `src/lib/storage/__tests__/db.test.ts` (their behaviour is now covered by the repo tests)
- Create: `src/server/repos/data.server.ts`, `src/features/data/data.functions.ts`, `src/lib/legacy-import.ts`, `src/components/app/legacy-import-banner.tsx`
- Modify: all files under `src/routes/**`, `src/components/app/{app-shell,clinician-control,theme-toggle,demo-banner}.tsx`, `src/components/patient/{patient-form,patient-table}.tsx`, `src/components/donor/{donor-form,donor-table,screening-table}.tsx`, `src/components/evaluation/{decision-form,pair-picker}.tsx`, `src/components/criteria/criteria-form.tsx`
- Test: `src/server/repos/__tests__/data.db.test.ts`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces:
  - `importBackup(db, raw: unknown, actor): Promise<ImportSummary>`, where `ImportSummary = { patients: number; donors: number; matches: number; decisions: number; skipped: number }`
  - `exportAll(exec): Promise<BackupV2>`
  - `resetAll(db, actor): Promise<void>`
  - `seedDemo(db, actor): Promise<{ patients: number; donors: number; runs: number }>`
  - server fns: `exportDataFn`, `importDataFn`, `resetDataFn`, `seedDemoFn`
  - `readLegacyBackup(): unknown | null`, `markLegacyImported(): void`

- [ ] **Step 1: Data repository test (failing)**

Create `src/server/repos/__tests__/data.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closeTestDb, resetTestDb, testDb } from "../../db/test-db.server"
import { exportAll, importBackup, resetAll } from "../data.server"
import { listMatches } from "../matches.server"
import { listPatients } from "../patients.server"
import { evaluate } from "@/domain/engine"
import { DEFAULT_CRITERIA } from "@/domain/criteria"
import { defaultPairInputs } from "@/domain/factories"
import { donor, patient } from "@/domain/__tests__/builders"

const at = "2026-11-10T10:00:00.000Z"
function legacyBackup() {
  const p = patient({ id: "pat_legacy" })
  const gone = patient({ id: "pat_deleted" }) // deleted in the old app; only its snapshot survives
  const d = donor({ id: "don_legacy" })
  const ev = (id: string, pt: typeof p) => ({
    id, createdAt: at, createdBy: "Dr Old", patientId: pt.id, donorId: d.id,
    patientSnapshot: pt, donorSnapshot: d, criteriaVersionId: "criteria-v1", criteriaVersion: 1,
    criteriaSnapshot: DEFAULT_CRITERIA, pair: defaultPairInputs(),
    result: evaluate({ patient: pt, donor: d, pair: defaultPairInputs(), criteria: DEFAULT_CRITERIA, now: new Date(at) }),
    decision: null,
  })
  return {
    schemaVersion: 1, clinicianName: "Dr Old", patients: [p], donors: [d],
    evaluations: [ev("evl_1", p), ev("evl_2", gone)],
    criteriaVersions: [{ id: "criteria-v1", version: 1, createdAt: at, author: "System", changeNote: "Initial", criteria: DEFAULT_CRITERIA }],
    audit: [{ id: "aud_old", at, actor: "Dr Old", action: "evaluation.created", subjectId: "evl_1", summary: "x" }],
  }
}

describe("data import/export", () => {
  beforeEach(resetTestDb)
  afterAll(closeTestDb)

  it("imports a v1 localStorage backup, keeping ids, and is idempotent", async () => {
    const db = testDb()
    const first = await importBackup(db, legacyBackup(), "Dr New")
    expect(first).toMatchObject({ patients: 1, donors: 1, matches: 2 })
    expect((await listPatients(db, {})).items.map((r) => r.id)).toEqual(["pat_legacy"]) // deleted one stays hidden
    expect((await listMatches(db, {})).items).toHaveLength(2)
    const second = await importBackup(db, legacyBackup(), "Dr New")
    expect(second).toMatchObject({ patients: 0, donors: 0, matches: 0 })
  })

  it("rejects an invalid backup without writing", async () => {
    const db = testDb()
    await expect(importBackup(db, { schemaVersion: 1 }, "Dr New")).rejects.toBeTruthy()
    expect((await listPatients(db, {})).items).toHaveLength(0)
  })

  it("exports what it imported and resets to a single criteria version", async () => {
    const db = testDb()
    await importBackup(db, legacyBackup(), "Dr New")
    const out = await exportAll(db)
    expect(out.patients.map((p) => p.id)).toContain("pat_legacy")
    await resetAll(db, "Dr New")
    const after = await exportAll(db)
    expect(after.patients).toHaveLength(0)
    expect(after.criteriaVersions).toHaveLength(1)
  })
})
```

Run: `bun run test:db`
Expected: FAIL.

- [ ] **Step 2: Implement the data repository**

```bash
git mv src/lib/storage/validated-db-schema.ts src/domain/backup-schema.ts
```

In the moved file, change the imports to `./criteria` and `./schema`.

Create `src/server/repos/data.server.ts`:

```ts
import { sql } from "drizzle-orm"
import { auditLog, criteriaVersions, decisions, donors, matchResults, patients } from "../db/schema.server"
import type { Db, Executor, Tx } from "../db/client.server"
import { appendAudit } from "./audit.server"
import { ensureInitialCriteria, listCriteriaVersions } from "./criteria.server"
import { donorCols } from "./donors.server"
import { patientCols } from "./patients.server"
import { enqueueRun } from "./runs.server"
import { putSnapshots } from "./snapshots.server"
import { validatedDbSchema } from "@/domain/backup-schema"
import { DEMO_DONORS, DEMO_PATIENTS } from "@/domain/demo-data"
import { LEGACY_AUDIT_ACTION } from "@/domain/match-types"
import type { Donor, Patient } from "@/domain/schema"
import { AppError } from "@/lib/app-error"

export type ImportSummary = { patients: number; donors: number; matches: number; decisions: number; skipped: number }

async function upsertRecords(tx: Tx, list: Patient[] | Donor[], kind: "patient" | "donor", deletedAt: Date | null): Promise<number> {
  let inserted = 0
  for (const r of list) {
    const base = { id: r.id, version: 1, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt), deletedAt }
    const rows = kind === "patient"
      ? await tx.insert(patients).values({ ...base, ...patientCols(r as Patient), data: r as Patient }).onConflictDoNothing().returning({ id: patients.id })
      : await tx.insert(donors).values({ ...base, ...donorCols(r as Donor), data: r as Donor }).onConflictDoNothing().returning({ id: donors.id })
    inserted += rows.length
  }
  return inserted
}

/** All-or-nothing. Existing ids are skipped (reported), never overwritten. */
export async function importBackup(db: Db, raw: unknown, actor: string): Promise<ImportSummary> {
  const backup = validatedDbSchema.parse(raw)
  return db.transaction(async (tx) => {
    // Criteria history must agree version-by-version, or result references would point at different thresholds.
    const existing = new Map((await listCriteriaVersions(tx)).map((v) => [v.version, v.id]))
    for (const v of backup.criteriaVersions) {
      const id = existing.get(v.version)
      if (id && id !== v.id)
        throw new AppError("CONFLICT", `Criteria version ${v.version} in the backup differs from this database. Reset before importing.`)
      if (!id)
        await tx.insert(criteriaVersions).values({ id: v.id, version: v.version, author: v.author, changeNote: v.changeNote, criteria: v.criteria, createdAt: new Date(v.createdAt) })
    }
    const summary: ImportSummary = { patients: 0, donors: 0, matches: 0, decisions: 0, skipped: 0 }
    summary.patients = await upsertRecords(tx, backup.patients, "patient", null)
    summary.donors = await upsertRecords(tx, backup.donors, "donor", null)

    // Records deleted in v1 survive only as snapshots: restore them as soft-deleted rows so FKs hold.
    const known = new Set([...backup.patients.map((p) => p.id), ...backup.donors.map((d) => d.id)])
    const now = new Date()
    for (const e of backup.evaluations) {
      if (!known.has(e.patientId)) await upsertRecords(tx, [e.patientSnapshot], "patient", now)
      if (!known.has(e.donorId)) await upsertRecords(tx, [e.donorSnapshot], "donor", now)
      const [ph, dh] = await putSnapshots(tx, [{ kind: "patient", data: e.patientSnapshot }, { kind: "donor", data: e.donorSnapshot }])
      const rows = await tx.insert(matchResults).values({
        id: e.id, runId: null, source: "checked", patientId: e.patientId, donorId: e.donorId,
        patientName: `${e.patientSnapshot.identity.firstName} ${e.patientSnapshot.identity.lastName}`.trim(),
        donorCode: e.donorSnapshot.identity.donorId, patientSnapshot: ph, donorSnapshot: dh,
        criteriaVersionId: e.criteriaVersionId, engineVersion: e.result.engineVersion, pair: e.pair, result: e.result,
        overall: e.result.overall, blockerCount: e.result.blockers.length, missingCount: e.result.missingCount,
        screenKey: null, createdBy: e.createdBy || "Unspecified clinician", createdAt: new Date(e.createdAt),
      }).onConflictDoNothing().returning({ id: matchResults.id })
      if (!rows.length) { summary.skipped++; continue }
      summary.matches++
      if (e.decision) {
        await tx.insert(decisions).values({
          id: `dec_${e.id}`, matchId: e.id, verdict: e.decision.verdict, clinician: e.decision.clinician, rationale: e.decision.rationale,
          reasons: e.decision.reasons, acknowledgedFindings: e.decision.acknowledgedFindings, decidedAt: new Date(e.decision.decidedAt),
        }).onConflictDoNothing()
        summary.decisions++
      }
    }
    for (const a of backup.audit)
      await tx.insert(auditLog).values({
        id: a.id, at: new Date(a.at), actor: a.actor, action: LEGACY_AUDIT_ACTION[a.action] ?? a.action, subjectId: a.subjectId, summary: a.summary,
      }).onConflictDoNothing()
    await appendAudit(tx, { actor, action: "data.imported", subjectId: "backup", summary: `Imported ${summary.patients} patients, ${summary.donors} donors, ${summary.matches} match results` })
    return summary
  })
}
```

Then the export, the v2 backup type, and reset:

```ts
export type BackupV2 = {
  format: "hla-trans.v2"
  exportedAt: string
  patients: Patient[]
  donors: Donor[]
  criteriaVersions: Awaited<ReturnType<typeof listCriteriaVersions>>
  matches: Array<{ id: string; source: string; patientId: string; donorId: string; createdAt: string; overall: string }>
}

export async function exportAll(exec: Executor): Promise<BackupV2> {
  const [ps, ds, cv, ms] = await Promise.all([
    exec.select({ data: patients.data }).from(patients).where(sql`${patients.deletedAt} is null`),
    exec.select({ data: donors.data }).from(donors).where(sql`${donors.deletedAt} is null`),
    listCriteriaVersions(exec),
    exec.select({ id: matchResults.id, source: matchResults.source, patientId: matchResults.patientId, donorId: matchResults.donorId, createdAt: matchResults.createdAt, overall: matchResults.overall }).from(matchResults),
  ])
  return {
    format: "hla-trans.v2", exportedAt: new Date().toISOString(),
    patients: ps.map((r) => r.data), donors: ds.map((r) => r.data), criteriaVersions: cv,
    matches: ms.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  }
}

/** Audited wipe. TRUNCATE is the one path allowed past the immutability triggers. */
export async function resetAll(db: Db, actor: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`)
    await ensureInitialCriteria(tx)
    await appendAudit(tx, { actor, action: "data.reset", subjectId: "database", summary: "Reset database" })
  })
}
```

**Backup format decision:** the v2 export is a records-and-index backup for human review. The authoritative backup of a Postgres database is `pg_dump`, which the README documents (Task 15). Import accepts the v1 format, which is what both legacy localStorage and old exports produce. This keeps one import path. State this on the Data page (Step 7).

Run: `bun run test:db`
Expected: PASS.

- [ ] **Step 3: Seed function (temporary data, replaced in Task 14)**

Append to `data.server.ts` (its imports already include `DEMO_*` and `enqueueRun`):

```ts
export async function seedDemo(db: Db, actor: string) {
  return db.transaction(async (tx) => {
    await ensureInitialCriteria(tx)
    const p = await upsertRecords(tx, DEMO_PATIENTS, "patient", null)
    const d = await upsertRecords(tx, DEMO_DONORS, "donor", null)
    let runs = 0
    for (const donor of DEMO_DONORS.filter((x) => x.identity.state === "available")) {
      await enqueueRun(tx, { subjectKind: "donor", subjectId: donor.id, subjectLabel: donor.identity.donorId, trigger: "seed", actor })
      runs++
    }
    await appendAudit(tx, { actor, action: "data.seeded", subjectId: "demo", summary: `Loaded demo dataset (${p} patients, ${d} donors)` })
    return { patients: p, donors: d, runs }
  })
}
```

Until Task 14, create `src/domain/demo-data/index.ts` re-exporting the current samples: `export { SAMPLE_PATIENTS as DEMO_PATIENTS, SAMPLE_DONORS as DEMO_DONORS } from "../sample-data"`.

- [ ] **Step 4: Data server functions**

Create `src/features/data/data.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware, writeMiddleware } from "@/features/shared/middleware"
import { getDb } from "@/server/db/client.server"
import { exportAll, importBackup, resetAll, seedDemo } from "@/server/repos/data.server"

export const exportDataFn = createServerFn({ method: "GET" }).middleware([errorMiddleware]).handler(() => exportAll(getDb()))
export const importDataFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ backup: z.unknown() })) // full validation happens in importBackup (one schema, one place)
  .handler(({ data, context }) => importBackup(getDb(), data.backup, context.actor))
export const resetDataFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .validator(z.object({ confirm: z.literal("RESET") }))
  .handler(({ context }) => resetAll(getDb(), context.actor))
export const seedDemoFn = createServerFn({ method: "POST" })
  .middleware([writeMiddleware])
  .handler(({ context }) => seedDemo(getDb(), context.actor))
```

- [ ] **Step 5: Rewrite each route with loader + suspense query**

Every route follows the same pattern. Here is the full patients list route; the table after it gives the values for every other route.

`src/routes/patients/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { patientListSearch } from "@/features/patients/patients.functions"
import { patientQueries } from "@/features/patients/patients.queries"
import { PageHeader } from "@/components/app/page-header"
import { PatientTable } from "@/components/patient/patient-table"

export const Route = createFileRoute("/patients/")({
  validateSearch: patientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(patientQueries.list(deps)),
  head: () => ({ meta: [{ title: "Patients · HLA-Trans" }] }),
  component: PatientsPage,
})

function PatientsPage() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(patientQueries.list(search))
  return (
    <>
      <PageHeader title="Patients" description="Transplant candidates and their listing status." />
      <PatientTable page={data} />
    </>
  )
}
```

Task 9 replaces the header actions and filter toolbar; this task only moves the data source.

| Route | `validateSearch` | Loader (`context.queryClient.…`) | Component reads |
|---|---|---|---|
| `/` | — | `ensureQueryData(dashboardQueries.summary())` | `useSuspenseQuery(dashboardQueries.summary())` |
| `/donors/` | `donorListSearch` | `ensureQueryData(donorQueries.list(deps))` | `donorQueries.list(search)` → `<DonorTable page={data} />` |
| `/patients/$patientId/` | — | `ensureOrNotFound(ensureQueryData(patientQueries.detail(params.patientId)))`, plus non-awaited `prefetchQuery(matchQueries.list({ patientId }))` | `patientQueries.detail(id)` → `{ record, version }` |
| `/patients/$patientId/edit` | — | `ensureOrNotFound(ensureQueryData(patientQueries.detail(id)))` | `<PatientForm initial={record} version={version} />` |
| `/donors/$donorId/` | — | same as patient detail with donor queries | `donorQueries.detail(id)` |
| `/donors/$donorId/edit` | — | same as patient edit | `<DonorForm initial={record} version={version} />` |
| `/matches/` | `matchListSearch` | `ensureQueryData(matchQueries.list(deps))` | `matchQueries.list(search)` |
| `/matches/$matchId` | — | `ensureOrNotFound(ensureQueryData(matchQueries.detail(id)))` | `matchQueries.detail(id)` → `MatchDetail` |
| `/matches/check` | `{ patientId?, donorId? }` | `ensureQueryData(criteriaQueries.latest())`; if a `patientId`/`donorId` is in the search, also `ensureQueryData` their detail queries | details through `useQuery` (non-suspense) keyed by the current selection |
| `/criteria` | — | `Promise.all([ensureQueryData(criteriaQueries.latest()), ensureQueryData(criteriaQueries.versions())])` | both |
| `/audit` | `auditSearch` | `ensureQueryData(auditQueries.list(deps))` | `auditQueries.list(search)` |
| `/data` | — | none | mutations only |

For every `$id` route, set `loaderDeps` to nothing and read `params` in the loader. For the `/donors/$donorId/` Matches tab, replace the client-side `screenDonor(...)` call with `useQuery(matchQueries.list({ donorId, order: "screen" }))`. The newest run's results then show in screening order (Task 11 adds a run selector).

- [ ] **Step 6: Point the components at server data**

- `PatientTable({ page }: { page: Page<PatientRow> })`: rows use `row.fullName`, `row.mrn`, `ageInYears(row.dateOfBirth)` (import from `@/domain/calc`), `row.abo`, `labelOf(CANDIDATE_STATE, row.listingState)`, `labelOf(URGENCY_STATUS, row.urgencyStatus)`, `row.cpra ?? "Not recorded"`, `labelOf(MCS_DEVICE, row.device)` and `row.listingDate || "Not recorded"`. Remove the in-memory filter and sort state; Task 9 adds URL filters.
- `DonorTable({ page }: { page: Page<DonorRow> })`: same treatment.
- `PatientForm({ initial, version }: { initial: Patient; version?: number })`: replace `actions.savePatient` with this:

```tsx
const create = useCreatePatient()
const update = useUpdatePatient()
const saving = create.isPending || update.isPending
// in save():
const result = version === undefined
  ? (await create.mutateAsync(candidate)).patient
  : await update.mutateAsync({ patient: candidate, expectedVersion: version })
flushSync(() => form.reset({ ...result.record, unacceptableAntigensText: result.record.sensitization.unacceptableAntigens.join(", ") }))
toast.add({ title: version === undefined ? "Patient saved. Matching started." : "Patient saved" })
void navigate({ to: "/patients/$patientId", params: { patientId: result.record.id } })
```

  `save` becomes `async`. In the `catch`, if `isAppError(error) && error.code === "VALIDATION"`, merge `error.issues` into the form errors (`form.setErrors`; add `setErrors` to the hook return). Otherwise set `saveError` to the message. Disable the submit button while `saving` and show `<Spinner />Saving…`.
- `DonorForm`: same.
- `decision-form.tsx`: takes `match: MatchDetail` and uses `useDecideMatch(match.id)`.
- `pair-picker.tsx`: each picker is a Combobox backed by `useQuery({ ...patientQueries.list({ q, sort: "name" }), placeholderData: keepPreviousData })`, where `q` comes from the Combobox input state debounced by 200 ms (`useDeferredValue` is not enough because it does not delay the request). Items are `{ value: row.id, label: \`${row.fullName} · ${row.mrn}\` }`.
- `criteria-form.tsx`: the `publish` prop becomes `usePublishCriteria().mutateAsync`.
- `ClinicianControl`: reads `Route.useRouteContext()` from the root (`getRouteApi("__root__").useRouteContext()`). Save writes the cookie with `writePrefCookie(CLINICIAN_COOKIE, name.trim())`, then calls `router.invalidate()` so `prefs` refreshes.
- `ThemeToggle`: reads `prefs.theme` the same way. On toggle: `writePrefCookie(THEME_COOKIE, next)`, flip `document.documentElement.classList` and `style.colorScheme` immediately, then `router.invalidate()`.
- `AppShell`: remove `useDb`, `dbStore` and the recovery notice. Render `<LegacyImportBanner />` above `{children}`.
- `DemoBanner`: text becomes "Demo environment: synthetic records. Not for clinical use."

- [ ] **Step 7: Data page and legacy import**

Create `src/lib/legacy-import.ts`:

```ts
const LEGACY_KEY = "hla-trans.db.v1"
const DONE_KEY = "hla-trans.db.v1.imported"

/** Reads the v1 localStorage database once. Returns null when absent, already imported, or unreadable. */
export function readLegacyBackup(): unknown | null {
  try {
    if (localStorage.getItem(DONE_KEY)) return null
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export function markLegacyImported(): void {
  try {
    localStorage.setItem(DONE_KEY, new Date().toISOString())
  } catch {
    /* Banner may reappear; import is idempotent. */
  }
}

export function deleteLegacyData(): void {
  localStorage.removeItem(LEGACY_KEY)
}
```

Create `src/components/app/legacy-import-banner.tsx`:

```tsx
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { DatabaseZap } from "lucide-react"
import { importDataFn } from "@/features/data/data.functions"
import { markLegacyImported, readLegacyBackup } from "@/lib/legacy-import"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

export function LegacyImportBanner() {
  const [backup, setBackup] = useState<unknown | null>(null)
  useEffect(() => setBackup(readLegacyBackup()), []) // client only, after hydration
  const qc = useQueryClient()
  const importer = useMutation({
    mutationKey: ["data", "import-legacy"],
    meta: { errorTitle: "Browser data not imported" },
    mutationFn: () => importDataFn({ data: { backup } }),
    onSuccess: (s) => {
      markLegacyImported()
      setBackup(null)
      toast.add({ title: "Browser data imported", description: `${s.patients} patients, ${s.donors} donors, ${s.matches} match results.` })
      void qc.invalidateQueries()
    },
  })
  if (!backup) return null
  return (
    <Alert className="mb-6">
      <DatabaseZap aria-hidden="true" />
      <AlertTitle>Records found in this browser</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>Import them into the shared database. Existing records are never overwritten.</span>
        <Button size="sm" onClick={() => importer.mutate()} disabled={importer.isPending}>
          {importer.isPending && <Spinner />} Import browser data
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { markLegacyImported(); setBackup(null) }}>
          Not now
        </Button>
      </AlertDescription>
    </Alert>
  )
}
```

Rewrite the action handlers in `src/routes/data.tsx` to use mutations. Keep the existing preview and validation UI (it now imports `validatedDbSchema` from `@/domain/backup-schema`):

- **Export:** `const data = await queryClient.fetchQuery({ queryKey: ["data","export"], queryFn: () => exportDataFn(), staleTime: 0 })`. Download it as `hla-trans-${date}.json`, using the existing Blob code.
- **Import:** `useMutation({ mutationFn: (backup: unknown) => importDataFn({ data: { backup } }), onSuccess: () => qc.invalidateQueries() })`.
- **Reset:** keep the typed "RESET" field. Call `resetDataFn({ data: { confirm: "RESET" } })`, then `qc.clear()` and `router.invalidate()`.
- **Load demo dataset:** call `seedDemoFn()`, then `qc.invalidateQueries()`. Toast: "Demo data loaded. Matching started for N donors."
- **Delete browser copy:** shown only when `localStorage` has the legacy key. Calls `deleteLegacyData()`.
- **Copy:** "Exports contain patient and donor records and the criteria history. For a full database backup use `pg_dump` (see README)."

- [ ] **Step 8: Remove the old storage layer**

```bash
git rm src/lib/storage/db.ts src/lib/storage/local-store.ts src/lib/storage/__tests__/db.test.ts
grep -rn "lib/storage" src && echo "STILL REFERENCED" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 9: Verify**

Run: `bun run typecheck && bun run lint && bun run test && bun run test:db && bun run build`
Expected: PASS.

Manual check, with `bun run dev` (web + worker):
1. Set a clinician name, then add a donor.
   Expected: the toast says "Matching started". The worker log shows `succeeded`. `/matches` lists screening results.
2. Edit a patient used in those results.
   Expected: `/matches` marks them **Out of date**.
3. Open the same patient in two tabs. Save in tab A, then save in tab B.
   Expected: tab B shows "This patient changed since you opened it…".
4. In DevTools, set `localStorage["hla-trans.db.v1"]` to an old export and reload.
   Expected: the banner appears. Importing shows counts, and a second import adds 0.
5. View page source on `/patients`.
   Expected: the table rows are present in the SSR HTML.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: serve all screens from postgres via loaders and queries; legacy import; remove localStorage store"
```

---

## Phase 3: UI

### Task 8: Loading, empty and error states

**Files:**
- Create: `src/components/app/top-progress.tsx`, `src/components/app/submit-button.tsx`, `src/components/app/empty-state.tsx`
- Replace: `src/components/app/page-skeletons.tsx`, `src/components/app/route-error.tsx`
- Modify: `src/styles.css`, `src/components/app/app-shell.tsx`, every route file (add `pendingComponent`)

**Interfaces:**
- Produces:
  - skeletons: `PagePending`, `TablePageSkeleton({ columns, rows? })`, `DetailPageSkeleton`, `FormPageSkeleton`, `ResultPageSkeleton`
  - `RouteError`, `NotFound`
  - `SubmitButton({ pending, pendingLabel, children, ...ButtonProps })`
  - `EmptyState({ icon, title, description, action })`

- [ ] **Step 1: Top progress bar**

Add to `src/styles.css`:

```css
@keyframes hla-progress {
  0% { transform: scaleX(0.05); }
  60% { transform: scaleX(0.7); }
  100% { transform: scaleX(0.92); }
}
```

Create `src/components/app/top-progress.tsx`:

```tsx
import { useEffect, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { useIsFetching } from "@tanstack/react-query"
import { cn } from "cn"

/** Appears only after 150 ms so fast transitions stay visually silent. Ignores background polling. */
export function TopProgress() {
  const routing = useRouterState({ select: (s) => s.status === "pending" })
  const fetching = useIsFetching({ predicate: (q) => q.queryKey[0] !== "matching" && q.state.data === undefined }) > 0
  const active = routing || fetching
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [active])
  if (!visible) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary",
        "animate-[hla-progress_1.4s_ease-out_forwards] motion-reduce:animate-none"
      )}
    />
  )
}
```

The fetch predicate counts only first loads (`data === undefined`). Background refetches of data already on screen must never flash a bar (spec §7.2).

Render `<TopProgress />` as the first child of the `AppShell` root.

- [ ] **Step 2: Skeletons, errors, empty state, submit button**

Replace `src/components/app/page-skeletons.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

function Header() {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
  )
}

export function PagePending() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export function TablePageSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="border">
        {Array.from({ length: rows + 1 }, (_, r) => (
          <div key={r} className="grid gap-4 border-b p-3 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={r === 0 ? "h-3 w-20" : "h-4 w-full"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <Skeleton className="mb-4 h-8 w-80" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  )
}

export function FormPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Header />
      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,768px)_300px]">
        <Skeleton className="hidden h-96 xl:block" />
        <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
        <Skeleton className="hidden h-72 xl:block" />
      </div>
    </div>
  )
}

export function ResultPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-20 w-full" />
      <div className="mb-4 flex gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-32" />)}</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="hidden h-80 xl:block" />
      </div>
    </div>
  )
}
```

Replace `src/components/app/route-error.tsx`:

```tsx
import { useEffect } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { FileQuestion, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { errorMessage } from "@/lib/app-error"

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const boundary = useQueryErrorResetBoundary()
  // Let suspense queries refetch when the route retries.
  useEffect(() => boundary.reset(), [boundary])
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><TriangleAlert /></EmptyMedia>
        <EmptyTitle>This page could not load</EmptyTitle>
        <EmptyDescription>{errorMessage(error, "An unexpected error occurred.")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => { reset(); void router.invalidate() }}>Retry</Button>
      </EmptyContent>
    </Empty>
  )
}

export function NotFound() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FileQuestion /></EmptyMedia>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>This record does not exist or was deleted.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>Go to dashboard</Button>
      </EmptyContent>
    </Empty>
  )
}
```

Confirm that `EmptyMedia` accepts `variant="icon"`: `grep -n variant src/components/ui/empty.tsx`. If it does not, drop the prop.

Create `src/components/app/submit-button.tsx`:

```tsx
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SubmitButton({
  pending, pendingLabel = "Saving…", children, disabled, ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Spinner aria-hidden="true" />}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </Button>
  )
}
```

Create `src/components/app/empty-state.tsx`:

```tsx
import type { ReactNode } from "react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
```

- [ ] **Step 3: Pending component for each route**

| Route | `pendingComponent` |
|---|---|
| `/patients/` | `() => <TablePageSkeleton columns={8} />` |
| `/donors/` | `() => <TablePageSkeleton columns={7} />` |
| `/matches/`, `/matching/`, `/audit` | `() => <TablePageSkeleton columns={6} />` |
| `/patients/$patientId/`, `/donors/$donorId/`, `/matching/$runId` | `DetailPageSkeleton` |
| `*/new`, `*/edit`, `/matches/check`, `/criteria` | `FormPageSkeleton` |
| `/matches/$matchId` | `ResultPageSkeleton` |

Replace every "No … yet" paragraph in the tables with `EmptyState`, giving it one primary action. Examples: patients get `<Button nativeButton={false} render={<Link to="/patients/new" />}><Plus />Add patient</Button>`; an empty database gets a secondary "Load demo dataset" link to `/data`. Replace every form's submit button with `SubmitButton pending={mutation.isPending}`.

- [ ] **Step 4: Verify**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS.

Manual check: in DevTools, set Network to "Slow 4G" and navigate to a page you have not hovered.
Expected: the bar appears after 150 ms, then the matching skeleton shows; the layout does not jump when data arrives (CLS 0 in the Performance panel). Navigating to a page you hovered first shows no skeleton. Stop Postgres (`podman compose stop postgres`) and navigate.
Expected: the error view appears, with Retry. Restart Postgres and press Retry.
Expected: the page recovers.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): progress bar, route skeletons, error and empty states, pending buttons"
```

---

### Task 9: List toolbar, URL filters, keyset pager, page header actions

**Files:**
- Create: `src/components/app/list-toolbar.tsx`, `src/components/app/pager.tsx`, `src/components/app/page-actions.tsx`
- Modify: `src/components/app/page-header.tsx`, `src/components/patient/patient-table.tsx`, `src/components/donor/donor-table.tsx`, `src/routes/patients/index.tsx`, `src/routes/donors/index.tsx`, `src/routes/matches/index.tsx`, `src/routes/audit.tsx`, `src/routes/patients/$patientId.index.tsx`, `src/routes/donors/$donorId.index.tsx`
- Create: `src/components/match/match-table.tsx` (shared by match results, run detail and detail-page Matches tabs)

**Interfaces:**
- Produces:
  - `ListToolbar({ children, canReset, onReset })`
  - `SearchInput({ value, onChange, placeholder, label })`
  - `FilterSelect<T extends string>({ label, value, options, onChange })`
  - `Pager({ hasCursor, nextCursor, onFirst, onNext })`
  - `RecordActions({ editLink, checkLink, entityLabel, onRerun, rerunPending, onDelete, deletePending })`
  - `MatchTable({ rows, showPatient, showDonor, emptyText })`

- [ ] **Step 1: Toolbar primitives**

Create `src/components/app/list-toolbar.tsx`:

```tsx
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ListToolbar({ children, canReset, onReset }: { children: ReactNode; canReset: boolean; onReset: () => void }) {
  return (
    <div role="search" className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {canReset && (
        <Button variant="ghost" onClick={onReset}>
          <X aria-hidden="true" /> Reset
        </Button>
      )}
    </div>
  )
}

/** Local state for instant typing; pushes to the URL 200 ms after the last keystroke. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 200)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input aria-label={label} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} className="pl-8" />
    </div>
  )
}

const ALL = "__all__"
export function FilterSelect<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T | undefined; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T | undefined) => void }) {
  const items = [{ value: ALL, label: `${label}: All` }, ...options.map((o) => ({ value: o.value, label: `${label}: ${o.label}` }))]
  return (
    <Select items={items} value={value ?? ALL} onValueChange={(v) => onChange(v === ALL || v === null ? undefined : (v as T))}>
      <SelectTrigger aria-label={label} className="w-auto min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
```

`onChange` must be stable for the debounce effect. Callers pass a `useCallback`.

Create `src/components/app/pager.tsx`:

```tsx
import { ChevronRight, ChevronsLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Keyset paging is forward-only; Back in the browser returns to the previous page (each page is a URL). */
export function Pager({ hasCursor, nextCursor, onFirst, onNext }: { hasCursor: boolean; nextCursor: string | null; onFirst: () => void; onNext: (cursor: string) => void }) {
  if (!hasCursor && !nextCursor) return null
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-end gap-2">
      {hasCursor && <Button variant="outline" onClick={onFirst}><ChevronsLeft aria-hidden="true" />First page</Button>}
      {nextCursor && <Button variant="outline" onClick={() => onNext(nextCursor)}>Next page<ChevronRight aria-hidden="true" /></Button>}
    </nav>
  )
}
```

- [ ] **Step 2: Patients list with toolbar (template for donors, matches and audit)**

In `src/routes/patients/index.tsx`, replace the component:

```tsx
function PatientsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientQueries.list(search))
  const set = useCallback(
    (patch: Partial<PatientListSearch>) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, cursor: undefined }), replace: true }),
    [navigate]
  )
  const setQ = useCallback((q: string) => set({ q: q || undefined }), [set])
  const filtered = Boolean(search.q || search.state || search.abo || search.urgency)
  return (
    <>
      <PageHeader
        title="Patients"
        description="Transplant candidates and their listing status."
        actions={<Button nativeButton={false} render={<Link to="/patients/new" />}><Plus aria-hidden="true" />Add patient</Button>}
      />
      <ListToolbar canReset={filtered} onReset={() => void navigate({ search: {}, replace: true })}>
        <SearchInput label="Search patients" placeholder="Name or MRN" value={search.q ?? ""} onChange={setQ} />
        <FilterSelect label="Status" value={search.state} options={CANDIDATE_STATE} onChange={(state) => set({ state })} />
        <FilterSelect label="ABO" value={search.abo} options={ABO} onChange={(abo) => set({ abo })} />
        <FilterSelect label="Urgency" value={search.urgency} options={URGENCY_STATUS} onChange={(urgency) => set({ urgency })} />
        <FilterSelect label="Sort" value={search.sort} options={[{ value: "name", label: "Name" }, { value: "listed", label: "Recently listed" }] as const} onChange={(sort) => set({ sort })} />
      </ListToolbar>
      <PatientTable page={data} filtered={filtered} />
      <Pager
        hasCursor={Boolean(search.cursor)}
        nextCursor={data.nextCursor}
        onFirst={() => void navigate({ search: (prev) => ({ ...prev, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (prev) => ({ ...prev, cursor }) })}
      />
    </>
  )
}
```

`CANDIDATE_STATE`, `ABO` and `URGENCY_STATUS` are the `{ value, label }` option arrays from `@/domain/options`. If `ABO` entries carry extra fields, the generic still infers `T` from `value`.

Apply the same layout to these routes:
- **`/donors/`:** search "Donor ID or hospital". Filters: `DONOR_STATE`, `ABO`, `DONATION_TYPE`. Sort: `updated | code`. Action "Add donor" (default variant, `Plus` icon) linking to `/donors/new`.
- **`/matches/`:** filters overall (`pass/review/fail`), decision (`pending/decided`), source (`screening/checked`), plus the two `DatePickerField`s from Task 12. Until Task 12 lands, keep the existing date fields; they are swapped in Task 12 Step 5. Action "Check a pair" links to `/matches/check`.
- **`/audit`:** a filter over the action values.

- [ ] **Step 3: Shared match table**

Create `src/components/match/match-table.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import type { MatchRow } from "@/domain/match-types"
import { StatusBadge } from "@/components/app/status"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/app/empty-state"

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

export function MatchTable({ rows, showPatient = true, showDonor = true, emptyText }: { rows: MatchRow[]; showPatient?: boolean; showDonor?: boolean; emptyText: string }) {
  if (!rows.length) return <EmptyState icon={<History />} title="No match results" description={emptyText} />
  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs text-muted-foreground uppercase">
          <tr>
            <th className="p-3 font-medium">Result</th>
            {showPatient && <th className="p-3 font-medium">Patient</th>}
            {showDonor && <th className="p-3 font-medium">Donor</th>}
            <th className="p-3 font-medium">Blockers</th>
            <th className="p-3 font-medium">Missing</th>
            <th className="p-3 font-medium">Source</th>
            <th className="p-3 font-medium">Decision</th>
            <th className="p-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              <td className="p-3">
                <Link to="/matches/$matchId" params={{ matchId: r.id }} className="inline-flex items-center gap-2 focus-visible:outline-2">
                  <StatusBadge status={r.overall} />
                  {r.outOfDate && <Badge variant="outline">Out of date</Badge>}
                </Link>
              </td>
              {showPatient && <td className="p-3"><Link to="/patients/$patientId" params={{ patientId: r.patientId }} className="hover:underline">{r.patientName}</Link></td>}
              {showDonor && <td className="p-3 font-mono"><Link to="/donors/$donorId" params={{ donorId: r.donorId }} className="hover:underline">{r.donorCode}</Link></td>}
              <td className="p-3 tabular-nums">{r.blockerCount}</td>
              <td className="p-3 tabular-nums">{r.missingCount}</td>
              <td className="p-3">{r.source === "checked" ? "Checked pair" : "Screening"}</td>
              <td className="p-3">{r.decision ?? (r.source === "checked" ? "Pending" : "—")}</td>
              <td className="p-3 whitespace-nowrap text-muted-foreground"><time dateTime={r.createdAt}>{fmt.format(new Date(r.createdAt))}</time></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

Confirm the `Badge` variant names with `grep -n "variant" src/components/ui/badge.tsx`, and use the outline-style variant that exists.

- [ ] **Step 4: Detail page header actions**

In `src/components/app/page-header.tsx`, change the actions wrapper class to `flex flex-wrap items-center gap-2`. This centres the action row vertically instead of top-aligning it.

Create `src/components/app/page-actions.tsx`:

```tsx
import { useState } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function RecordActions({
  editLink, checkLink, entityLabel, onRerun, rerunPending, onDelete, deletePending,
}: {
  editLink: LinkOptions
  checkLink: LinkOptions
  entityLabel: "patient" | "donor"
  onRerun: () => void
  rerunPending: boolean
  /** Resolves on success; the dialog stays open (and pending) until then. */
  onDelete: () => Promise<void>
  deletePending: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <>
      <Button nativeButton={false} render={<Link {...editLink} />}>
        <Pencil aria-hidden="true" /> Edit {entityLabel}
      </Button>
      <Button variant="outline" nativeButton={false} render={<Link {...checkLink} />}>
        Check a pair
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRerun} disabled={rerunPending}>
            <RefreshCw aria-hidden="true" /> Rerun matching
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" /> Delete {entityLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !deletePending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              The {entityLabel} is removed from lists and future matching. Saved match results keep their snapshots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deletePending} onClick={() => void onDelete().then(() => setConfirmOpen(false), () => undefined)}>
              {deletePending && <Spinner aria-hidden="true" />} Delete {entityLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

Confirm that `DropdownMenuItem` supports `variant="destructive"` (`grep -n variant src/components/ui/dropdown-menu.tsx`); if not, use `className="text-destructive"`. The rerun handler shows a toast with a "View" action to the new run, using the `runId` returned by the mutation.

Use it in the donor detail route:

```tsx
const del = useDeleteDonor()
const rerun = useRerunDonor()
const navigate = Route.useNavigate()
// header actions:
<RecordActions
  entityLabel="donor"
  editLink={{ to: "/donors/$donorId/edit", params: { donorId } }}
  checkLink={{ to: "/matches/check", search: { donorId } }}
  onRerun={() => rerun.mutate(donorId, { onSuccess: ({ runId }) => toast.add({ title: "Matching started", actionProps: { children: "View", onClick: () => void navigate({ to: "/matching/$runId", params: { runId } }) } }) })}
  rerunPending={rerun.isPending}
  deletePending={del.isPending}
  onDelete={async () => {
    await del.mutateAsync(donorId)
    toast.add({ title: "Donor deleted" })
    void navigate({ to: "/donors" })
  }}
/>
```

`/matching/$runId` does not exist until Task 10. Until then, point "View" to `/matches` with `search: { runId }`, and switch it in Task 10 Step 6. Use the same code for patients.

- [ ] **Step 5: Verify**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS.

Manual check: on `/donors`, type in search, then pick filters.
Expected: the URL updates; Back restores each state; the table never blanks (the previous rows stay until the next page is ready).
Expected: on the donor detail page, Edit, Check a pair and More sit on one baseline at equal height (h-8).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): compact URL-driven filter toolbars, keyset pager, aligned record actions"
```

---

### Task 10: Matching UI: live indicator, completion toasts, Matching pages

**Files:**
- Create: `src/features/matching/components/run-progress-card.tsx`, `src/features/matching/components/run-indicator.tsx`, `src/features/matching/components/run-watcher.tsx`, `src/features/matching/components/run-history-table.tsx`
- Create: `src/routes/matching/index.tsx`, `src/routes/matching/$runId.tsx`
- Modify: `src/components/app/app-shell.tsx`, `src/components/app/app-sidebar.tsx`
- Test: `src/features/matching/__tests__/run-math.test.ts`
- Create: `src/features/matching/run-math.ts`

**Interfaces:**
- Produces:
  - `runProgress(run: RunRow, nowMs: number): { percent: number; etaSeconds: number | null; elapsedSeconds: number }`
  - `finishedRunIds(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): string[]`
  - components `RunIndicator`, `RunWatcher`, `RunProgressCard`, `RunHistoryTable`

- [ ] **Step 1: Write the failing run-math test**

Create `src/features/matching/__tests__/run-math.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { finishedRunIds, runProgress } from "../run-math"
import type { RunRow } from "@/domain/match-types"

const base: RunRow = {
  id: "run_1", trigger: "donor.created", subjectKind: "donor", subjectId: "don_1", subjectLabel: "AHFK214", criteriaVersion: 1,
  status: "running", total: 200, processed: 50, passCount: 0, reviewCount: 0, failCount: 0, error: null, cancelRequested: false,
  createdBy: "Dr A", createdAt: "2026-11-14T12:00:00.000Z", startedAt: "2026-11-14T12:00:00.000Z", finishedAt: null,
}

describe("runProgress", () => {
  it("computes percent and ETA from observed rate", () => {
    const p = runProgress(base, Date.parse("2026-11-14T12:00:10.000Z"))
    expect(p.percent).toBe(25)
    expect(p.elapsedSeconds).toBe(10)
    expect(p.etaSeconds).toBe(30) // 150 left at 5/s
  })
  it("has no ETA before progress or when total is unknown", () => {
    expect(runProgress({ ...base, processed: 0 }, Date.parse("2026-11-14T12:00:10Z")).etaSeconds).toBeNull()
    expect(runProgress({ ...base, total: null }, Date.parse("2026-11-14T12:00:10Z")).percent).toBe(0)
  })
  it("treats an empty candidate set as complete", () => {
    expect(runProgress({ ...base, total: 0, processed: 0 }, Date.now()).percent).toBe(100)
  })
})

describe("finishedRunIds", () => {
  it("returns ids that left the active list", () => {
    expect(finishedRunIds(["a", "b", "c"], ["b", "d"])).toEqual(["a", "c"])
  })
})
```

Run: `bunx vitest run src/features/matching`
Expected: FAIL.

- [ ] **Step 2: Implement the run math**

Create `src/features/matching/run-math.ts`:

```ts
import type { RunRow } from "@/domain/match-types"

export function runProgress(run: RunRow, nowMs: number) {
  const startMs = run.startedAt ? Date.parse(run.startedAt) : nowMs
  const elapsedSeconds = Math.max(0, Math.round((nowMs - startMs) / 1000))
  if (run.total === null) return { percent: 0, etaSeconds: null, elapsedSeconds }
  if (run.total === 0) return { percent: 100, etaSeconds: 0, elapsedSeconds }
  const percent = Math.min(100, Math.round((run.processed / run.total) * 100))
  const rate = elapsedSeconds > 0 ? run.processed / elapsedSeconds : 0
  const etaSeconds = rate > 0 ? Math.ceil((run.total - run.processed) / rate) : null
  return { percent, etaSeconds, elapsedSeconds }
}

export function finishedRunIds(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): string[] {
  const live = new Set(next)
  return prev.filter((id) => !live.has(id))
}
```

Run: `bunx vitest run src/features/matching`
Expected: PASS.

- [ ] **Step 3: Progress card, indicator and watcher**

Create `src/features/matching/components/run-progress-card.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { useCancelRun } from "../matching.mutations"
import { runProgress } from "../run-math"
import type { RunRow } from "@/domain/match-types"

const TRIGGER: Record<RunRow["trigger"], string> = {
  "donor.created": "New donor", "patient.created": "New patient", manual: "Manual rerun", seed: "Demo data",
}
const duration = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`)

export function RunProgressCard({ run, compact = false }: { run: RunRow; compact?: boolean }) {
  const cancel = useCancelRun()
  const p = runProgress(run, Date.now())
  const queued = run.status === "queued"
  return (
    <article className="space-y-2 border bg-card p-3" aria-label={`Matching ${run.subjectLabel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{run.subjectLabel}</p>
          <p className="text-xs text-muted-foreground">
            {TRIGGER[run.trigger]} · {run.subjectKind === "donor" ? "vs active patients" : "vs available donors"} · criteria v{run.criteriaVersion}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3" aria-hidden="true" />
          {queued ? "Queued" : run.cancelRequested ? "Cancelling" : `${p.percent}%`}
        </span>
      </div>
      <Progress value={queued ? null : p.percent} aria-label="Matching progress" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          {run.processed}/{run.total ?? "…"} pairs · {run.passCount} pass · {run.reviewCount} review · {run.failCount} fail
          {!queued && ` · ${duration(p.elapsedSeconds)}${p.etaSeconds !== null ? ` · ~${duration(p.etaSeconds)} left` : ""}`}
        </span>
        {!compact && (
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link to="/matching/$runId" params={{ runId: run.id }} />}>Open</Button>
            <Button size="sm" variant="ghost" disabled={cancel.isPending || run.cancelRequested} onClick={() => cancel.mutate(run.id)}>Cancel</Button>
          </span>
        )}
      </div>
    </article>
  )
}
```

`Progress value={null}` renders an indeterminate bar in Base UI.

Create `src/features/matching/components/run-indicator.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { matchingQueries } from "../matching.queries"
import { RunProgressCard } from "./run-progress-card"

export function RunIndicator() {
  const { data: runs = [] } = useQuery(matchingQueries.active())
  if (!runs.length) return null
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" aria-label={`${runs.length} matching runs in progress`} />}>
        <Spinner aria-hidden="true" /> {runs.length} matching
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-2">
        {runs.slice(0, 5).map((run) => <RunProgressCard key={run.id} run={run} />)}
        <Button variant="link" nativeButton={false} render={<Link to="/matching" />}>All matching runs</Button>
      </PopoverContent>
    </Popover>
  )
}
```

Create `src/features/matching/components/run-watcher.tsx`:

```tsx
import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { toast } from "@/components/ui/toast"
import { matchingKeys, matchingQueries } from "../matching.queries"
import { finishedRunIds } from "../run-math"
import { matchKeys } from "@/features/matches/matches.queries"
import { dashboardKeys } from "@/features/dashboard/dashboard.queries"

/** Mounted once in the shell. Turns "left the active list" into a toast plus targeted invalidation. */
export function RunWatcher() {
  const { data } = useQuery(matchingQueries.active())
  const prev = useRef<string[] | null>(null)
  const qc = useQueryClient()
  const router = useRouter()
  useEffect(() => {
    if (!data) return
    const ids = data.map((r) => r.id)
    const done = prev.current ? finishedRunIds(prev.current, ids) : [] // first load: no toasts for history
    prev.current = ids
    if (!done.length) return
    void qc.invalidateQueries({ queryKey: matchKeys.all })
    void qc.invalidateQueries({ queryKey: dashboardKeys.all })
    void qc.invalidateQueries({ queryKey: [...matchingKeys.all, "history"] })
    for (const id of done)
      void qc.fetchQuery({ ...matchingQueries.detail(id), staleTime: 0 }).then((run) =>
        toast.add({
          type: run.status === "succeeded" ? "success" : run.status === "failed" ? "error" : undefined,
          title: `Matching ${run.status === "succeeded" ? "finished" : run.status} for ${run.subjectLabel}`,
          description: run.status === "succeeded" ? `${run.passCount} pass · ${run.reviewCount} review · ${run.failCount} fail` : (run.error ?? undefined),
          actionProps: { children: "View", onClick: () => void router.navigate({ to: "/matching/$runId", params: { runId: id } }) },
        })
      )
  }, [data, qc, router])
  return null
}
```

In `AppShell`: render `<RunWatcher />` once, and render `<RunIndicator />` in the header before `<ClinicianControl />`.

In `AppSidebar`, add the "Matching" item between Donors and Match results (`{ label: "Matching", link: { to: "/matching" }, isActive: under("/matching") }`). Render a count badge from `useQuery(matchingQueries.active())`; it shares the cached query, so there is no extra request.

- [ ] **Step 4: Matching page**

Create `src/routes/matching/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Activity } from "lucide-react"
import { runHistorySearch } from "@/features/matching/matching.functions"
import { matchingQueries } from "@/features/matching/matching.queries"
import { RunProgressCard } from "@/features/matching/components/run-progress-card"
import { RunHistoryTable } from "@/features/matching/components/run-history-table"
import { PageHeader } from "@/components/app/page-header"
import { ListToolbar, FilterSelect } from "@/components/app/list-toolbar"
import { Pager } from "@/components/app/pager"
import { EmptyState } from "@/components/app/empty-state"
import { TablePageSkeleton } from "@/components/app/page-skeletons"

export const Route = createFileRoute("/matching/")({
  validateSearch: runHistorySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(matchingQueries.active()),
      context.queryClient.ensureQueryData(matchingQueries.history(deps)),
    ]),
  head: () => ({ meta: [{ title: "Matching · HLA-Trans" }] }),
  pendingComponent: () => <TablePageSkeleton columns={7} />,
  component: MatchingPage,
})

function MatchingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: active = [] } = useQuery(matchingQueries.active()) // polling query; not suspense
  const { data: history } = useSuspenseQuery(matchingQueries.history(search))
  return (
    <>
      <PageHeader title="Matching" description="Background screening runs. Saving a patient or donor starts one automatically. Screening order is not OPTN allocation." />
      <section aria-labelledby="active-runs" className="mb-8">
        <h2 id="active-runs" className="mb-3 text-sm font-semibold">Active ({active.length})</h2>
        {active.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{active.map((r) => <RunProgressCard key={r.id} run={r} />)}</div>
        ) : (
          <EmptyState icon={<Activity />} title="Nothing running" description="New patients and donors are matched here automatically." />
        )}
      </section>
      <section aria-labelledby="run-history">
        <h2 id="run-history" className="mb-3 text-sm font-semibold">History</h2>
        <ListToolbar canReset={Boolean(search.status || search.subjectKind)} onReset={() => void navigate({ search: {}, replace: true })}>
          <FilterSelect label="Status" value={search.status} onChange={(status) => void navigate({ search: (p) => ({ ...p, status, cursor: undefined }), replace: true })}
            options={[{ value: "succeeded", label: "Succeeded" }, { value: "failed", label: "Failed" }, { value: "cancelled", label: "Cancelled" }, { value: "running", label: "Running" }, { value: "queued", label: "Queued" }] as const} />
          <FilterSelect label="Subject" value={search.subjectKind} onChange={(subjectKind) => void navigate({ search: (p) => ({ ...p, subjectKind, cursor: undefined }), replace: true })}
            options={[{ value: "donor", label: "Donor" }, { value: "patient", label: "Patient" }] as const} />
        </ListToolbar>
        <RunHistoryTable rows={history.items} />
        <Pager hasCursor={Boolean(search.cursor)} nextCursor={history.nextCursor}
          onFirst={() => void navigate({ search: (p) => ({ ...p, cursor: undefined }) })}
          onNext={(cursor) => void navigate({ search: (p) => ({ ...p, cursor }) })} />
      </section>
    </>
  )
}
```

Create `src/features/matching/components/run-history-table.tsx`, a table with these columns: Status (a `Badge` with an icon: CheckCircle2 for succeeded, XCircle for failed, Ban for cancelled, Loader for running, Clock for queued), Subject (a `Link` to `/matching/$runId` showing `subjectLabel`), Trigger (`TRIGGER` labels as in the card), Criteria (`v{criteriaVersion}`), Results (`{pass} · {review} · {fail}`, tabular-nums), Duration (`finishedAt - startedAt`, using `duration()`), Started by, and Finished (`Intl.DateTimeFormat`). The empty state reads "No runs yet."

- [ ] **Step 5: Run detail page**

Create `src/routes/matching/$runId.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { z } from "zod"
import { matchingQueries } from "@/features/matching/matching.queries"
import { matchQueries } from "@/features/matches/matches.queries"
import { RunProgressCard } from "@/features/matching/components/run-progress-card"
import { MatchTable } from "@/components/match/match-table"
import { PageHeader } from "@/components/app/page-header"
import { Pager } from "@/components/app/pager"
import { DetailPageSkeleton } from "@/components/app/page-skeletons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ensureOrNotFound } from "@/lib/route-helpers"

const search = z.object({
  overall: z.enum(["pass", "review", "fail"]).optional().catch(undefined),
  cursor: z.string().max(600).optional().catch(undefined),
})

export const Route = createFileRoute("/matching/$runId")({
  validateSearch: search,
  loaderDeps: ({ search: s }) => s,
  loader: ({ context, params, deps }) =>
    Promise.all([
      ensureOrNotFound(context.queryClient.ensureQueryData(matchingQueries.detail(params.runId))),
      context.queryClient.ensureQueryData(matchQueries.list({ runId: params.runId, order: "screen", ...deps })),
    ]),
  pendingComponent: DetailPageSkeleton,
  component: RunPage,
})

function RunPage() {
  const { runId } = Route.useParams()
  const s = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: run } = useSuspenseQuery(matchingQueries.detail(runId))
  const live = run.status === "queued" || run.status === "running"
  // While running, refresh the visible page of results every 2 s.
  const results = useQuery({ ...matchQueries.list({ runId, order: "screen", ...s }), refetchInterval: live ? 2_000 : false })
  return (
    <>
      <PageHeader
        title={`Matching · ${run.subjectLabel}`}
        description="Screening order: outcome, urgency, pediatric priority, blood type priority, time at status. Not OPTN allocation."
        breadcrumbs={[{ label: "Matching", link: { to: "/matching" } }, { label: run.subjectLabel }]}
      />
      {live && <div className="mb-6 max-w-xl"><RunProgressCard run={run} /></div>}
      <Tabs value={s.overall ?? "all"} onValueChange={(v) => void navigate({ search: { overall: v === "all" ? undefined : (v as "pass" | "review" | "fail") }, replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({run.passCount + run.reviewCount + run.failCount})</TabsTrigger>
          <TabsTrigger value="pass">Pass ({run.passCount})</TabsTrigger>
          <TabsTrigger value="review">Review ({run.reviewCount})</TabsTrigger>
          <TabsTrigger value="fail">Fail ({run.failCount})</TabsTrigger>
        </TabsList>
      </Tabs>
      <MatchTable rows={results.data?.items ?? []} showPatient={run.subjectKind === "donor"} showDonor={run.subjectKind === "patient"} emptyText={live ? "Results appear as pairs are processed." : "No results in this group."} />
      <Pager hasCursor={Boolean(s.cursor)} nextCursor={results.data?.nextCursor ?? null}
        onFirst={() => void navigate({ search: (p) => ({ ...p, cursor: undefined }) })}
        onNext={(cursor) => void navigate({ search: (p) => ({ ...p, cursor }) })} />
    </>
  )
}
```

- [ ] **Step 6: Point the "View" actions at the run page**

In the patient and donor detail routes (Task 9 Step 4) and in the create-form toasts (Task 7 Step 6), point "View" to `/matching/$runId`.

- [ ] **Step 7: Verify**

Run: `bun run typecheck && bun run lint && bun run test && bun run generate-routes`
Expected: PASS.

Manual check:
1. Seed 2,000 patients with `bun scripts/load-test.ts --seed-only` (Task 15) or the demo dataset. Add a donor, then navigate between Patients, Donors and Criteria while the run progresses.
   Expected: the header indicator updates every second; the pages stay responsive; a toast with a "View" action appears at the end.
2. Cancel a run.
   Expected: it reaches `cancelled` within one chunk.
3. Hide the tab for 30 s and watch DevTools Network.
   Expected: no polling requests while the tab is hidden.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(matching): live run indicator, completion toasts, matching history and run detail pages"
```

---

### Task 11: Donor and patient detail pages: overview, full clinical record, matches

**Files:**
- Create: `src/domain/risk-flags.ts`, `src/domain/__tests__/risk-flags.test.ts`
- Create: `src/components/record/record-spec.ts`, `src/components/record/donor-record.ts`, `src/components/record/patient-record.ts`, `src/components/record/record-view.tsx`
- Test: `src/components/record/__tests__/record-coverage.test.ts`
- Modify: `src/routes/donors/$donorId.index.tsx`, `src/routes/patients/$patientId.index.tsx`, `src/components/donor/donor-summary.tsx`, `src/components/patient/patient-summary.tsx`

**Interfaces:**
- Produces:
  - `RiskFlag = { id: string; severity: "fail" | "review" | "info"; title: string; detail: string; section: string }`
  - `donorRiskFlags(d: Donor, c: Criteria): RiskFlag[]` and `patientRiskFlags(p: Patient, now: Date): RiskFlag[]`
  - `RecordField = { path: string; label: string; unit?: string; options?: ReadonlyArray<{ value: string; label: string }>; format?: "date" | "bool" | "list" | "hla" | "multiline" }`
  - `RecordSection = { id: string; title: string; fields: RecordField[] }`
  - `donorRecordSections`, `patientRecordSections`, `RecordView({ sections, record, editLink })`
  - `leafPaths(value: unknown): string[]`

- [ ] **Step 1: Write the failing coverage test (guarantees "every field")**

Create `src/components/record/__tests__/record-coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { emptyDonor, emptyPatient } from "@/domain/factories"
import { donorRecordSections } from "../donor-record"
import { patientRecordSections } from "../patient-record"
import { leafPaths } from "../record-spec"

/** Metadata that is shown in the page header, not the clinical record. */
const IGNORED = new Set(["id", "createdAt", "updatedAt"])

function covered(sections: typeof donorRecordSections) {
  return new Set(sections.flatMap((s) => s.fields.map((f) => f.path)))
}

describe("clinical record coverage", () => {
  it("shows every donor field", () => {
    const missing = leafPaths(emptyDonor()).filter((p) => !IGNORED.has(p) && !covered(donorRecordSections).has(p))
    expect(missing).toEqual([])
  })
  it("shows every patient field", () => {
    const missing = leafPaths(emptyPatient()).filter((p) => !IGNORED.has(p) && !covered(patientRecordSections).has(p))
    expect(missing).toEqual([])
  })
})
```

Run: `bunx vitest run src/components/record`
Expected: FAIL (modules not found).

- [ ] **Step 2: Record spec and renderer**

Create `src/components/record/record-spec.ts`:

```ts
export type RecordField = {
  path: string
  label: string
  unit?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  format?: "date" | "bool" | "list" | "hla" | "multiline"
}
export type RecordSection = { id: string; title: string; fields: RecordField[] }

/**
 * Dotted paths to displayable leaves. Arrays and objects whose keys are data
 * (HLA loci, serology tests) count as one leaf, rendered by a format.
 */
export function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return prefix ? [prefix] : []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k))
}

export function getAtPath(record: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), record)
}
```

`leafPaths` recurses into every object. Nested objects such as `hla` and `infection.serology` therefore produce one path per key (`hla.A`, `infection.serology.hcvNat`), and the spec must list each one. That is intentional, because these values are clinically relevant. If a nested group is better shown as one block, list each key's path inside the same section with `format: "hla"` so the group renders as a grid.

Create `src/components/record/donor-record.ts`. Write it by walking `donorSchema` section by section, with one `RecordField` per leaf. Labels must be identical to the corresponding `donor-form.tsx` labels (copy them), and option lists come from `@/domain/options`. The sections and their order match the form: `identity, body, blood, donation, death, history, hemodynamics, echo, coronary, ecg, labs, infection, hla, notes`. Example of the required shape (complete the remaining fields in the same style until the coverage test passes):

```ts
import * as O from "@/domain/options"
import type { RecordSection } from "./record-spec"

export const donorRecordSections: RecordSection[] = [
  {
    id: "identity",
    title: "Identity",
    fields: [
      { path: "identity.donorId", label: "Donor ID" },
      { path: "identity.state", label: "State", options: O.DONOR_STATE },
      { path: "identity.donorHospital", label: "Donor hospital" },
      { path: "identity.opo", label: "OPO" },
      { path: "identity.referralDate", label: "Referral date", format: "date" },
      { path: "identity.ageYears", label: "Age", unit: "years" },
      { path: "identity.sex", label: "Sex", options: O.SEX },
      { path: "identity.ethnicity", label: "Ethnicity", options: O.ETHNICITY },
    ],
  },
  {
    id: "death",
    title: "Death",
    fields: [
      { path: "death.cause", label: "Cause of death", options: O.CAUSE_OF_DEATH },
      { path: "death.mechanism", label: "Mechanism of death", options: O.MECHANISM_OF_DEATH },
      { path: "death.circumstance", label: "Circumstance of death", options: O.CIRCUMSTANCE_OF_DEATH },
      { path: "death.carbonMonoxidePoisoning", label: "Carbon monoxide poisoning", format: "bool" },
      { path: "death.carboxyhemoglobinPct", label: "Carboxyhemoglobin", unit: "%" },
      { path: "death.cardiacArrest", label: "Cardiac arrest", options: O.TRI },
      { path: "death.cprMinutes", label: "CPR duration", unit: "min" },
      { path: "death.unexplainedSuddenDeath", label: "Unexplained sudden death", format: "bool" },
    ],
  },
  // body, blood, donation, history, hemodynamics, echo, coronary, ecg, labs, infection, hla, notes: one field per leaf
]
```

The coverage test is the acceptance gate: it lists every unlisted path. Do the same for `patient-record.ts` (sections in `patientSections` order).

Create `src/components/record/record-view.tsx`:

```tsx
import { memo } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkOptions } from "@tanstack/react-router"
import { Pencil } from "lucide-react"
import { labelOf } from "@/domain/options"
import { getAtPath } from "./record-spec"
import type { RecordField, RecordSection } from "./record-spec"

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
const isBlank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

function display(field: RecordField, value: unknown): string {
  if (field.options) return labelOf(field.options, value as string)
  if (field.format === "bool") return value ? "Yes" : "No"
  if (field.format === "date") return dateFmt.format(new Date(`${String(value)}T00:00:00Z`))
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).filter(Boolean).join(", ")
  return `${String(value)}${field.unit ? ` ${field.unit}` : ""}`
}

const Section = memo(function Section({ section, record, editLink }: { section: RecordSection; record: unknown; editLink: LinkOptions }) {
  return (
    <section aria-labelledby={`rec-${section.id}`} className="border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h3 id={`rec-${section.id}`} className="text-sm font-semibold">{section.title}</h3>
        <Link {...editLink} hash={section.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="size-3" aria-hidden="true" /> Edit section
        </Link>
      </header>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {section.fields.map((f) => {
          const v = getAtPath(record, f.path)
          return (
            <div key={f.path} className={f.format === "multiline" ? "sm:col-span-2" : undefined}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className={isBlank(v) ? "text-sm text-muted-foreground italic" : "text-sm font-medium whitespace-pre-wrap"}>
                {isBlank(v) ? "Not recorded" : display(f, v)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
})

export function RecordView({ sections, record, editLink }: { sections: RecordSection[]; record: unknown; editLink: LinkOptions }) {
  return <div className="grid gap-4 xl:grid-cols-2">{sections.map((s) => <Section key={s.id} section={s} record={record} editLink={editLink} />)}</div>
}
```

The rule that `bool` shows "No" for `false` is deliberate. Schema booleans are explicit checkboxes, not unknowns; unknowns are `tri` fields with options. Antibody rows are arrays of objects: give that field `format: "list"`, and in `display` special-case `sensitization.antibodies` to render `antigen MFI mfi (C1q c1q)` per row instead of JSON. Add this to `display` when writing the patient spec.

Run: `bunx vitest run src/components/record`
Expected: PASS once both specs are complete.

- [ ] **Step 3: Risk flags (failing test first)**

Create `src/domain/__tests__/risk-flags.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { donorRiskFlags } from "../risk-flags"
import { donor } from "./builders"

const ids = (d: Parameters<typeof donorRiskFlags>[0]) => donorRiskFlags(d, DEFAULT_CRITERIA).map((f) => f.id)

describe("donorRiskFlags", () => {
  it("is empty for a clean donor", () => {
    expect(ids(donor({ echo: { lvef: 60 }, death: { cardiacArrest: "no" } }))).toEqual([])
  })
  it("flags LVEF against the active criteria and prefers the repeat echo", () => {
    expect(ids(donor({ echo: { lvef: 35, repeatLvef: null } }))).toContain("lvef.fail")
    expect(ids(donor({ echo: { lvef: 35, repeatLvef: 55 } }))).not.toContain("lvef.fail")
    expect(ids(donor({ echo: { lvef: 45 } }))).toContain("lvef.review")
  })
  it("flags arrest with CPR minutes, CO, stimulants, DCD, PHS and positive serology", () => {
    const f = ids(donor({
      death: { cardiacArrest: "yes", cprMinutes: 40, carbonMonoxidePoisoning: true },
      history: { cocaine: "yes", phsRiskCriteria: ["ivDrugUse"] as never },
      donation: { type: "dcd" },
      infection: { serology: { hcvNat: "positive" } },
    }))
    expect(f).toEqual(expect.arrayContaining(["arrest", "co", "cocaine", "dcd", "phs", "serology.hcvNat"]))
  })
  it("treats an unrecorded LVEF as missing, never as normal", () => {
    expect(ids(donor({ echo: { lvef: null, repeatLvef: null } }))).toContain("lvef.missing")
  })
})
```

Take the PHS value from `PHS_RISK_VALUES[0]` instead of the literal if `"ivDrugUse"` is not a valid value; check with `grep -n "PHS_RISK_CRITERIA = " -A6 src/domain/options.ts`.

Run: `bunx vitest run src/domain/__tests__/risk-flags.test.ts`
Expected: FAIL.

Create `src/domain/risk-flags.ts`:

```ts
import { DONOR_TESTS, labelOf } from "./options"
import type { Criteria, Donor } from "./schema"

export type RiskFlag = { id: string; severity: "fail" | "review" | "info"; title: string; detail: string; section: string }

/** Facts that need a clinician's eye. Uses the same thresholds as the engine. Not a verdict. */
export function donorRiskFlags(d: Donor, c: Criteria): RiskFlag[] {
  const flags: RiskFlag[] = []
  const lvef = d.echo.repeatLvef ?? d.echo.lvef
  if (lvef === null)
    flags.push({ id: "lvef.missing", severity: "review", title: "LVEF not recorded", detail: "Echocardiography is required for size and function review.", section: "echo" })
  else if (lvef < c.donor.lvefReviewMin)
    flags.push({ id: "lvef.fail", severity: "fail", title: `LVEF ${lvef}%`, detail: `Below ${c.donor.lvefReviewMin}% (criteria v-active).`, section: "echo" })
  else if (lvef < c.donor.lvefPassMin)
    flags.push({ id: "lvef.review", severity: "review", title: `LVEF ${lvef}%`, detail: `Between ${c.donor.lvefReviewMin}% and ${c.donor.lvefPassMin}%.`, section: "echo" })
  if (d.death.cardiacArrest === "yes")
    flags.push({ id: "arrest", severity: (d.death.cprMinutes ?? Infinity) > c.donor.cprMinutesReview ? "review" : "info", title: "Cardiac arrest", detail: d.death.cprMinutes === null ? "CPR duration not recorded." : `CPR ${d.death.cprMinutes} min.`, section: "death" })
  if (d.death.carbonMonoxidePoisoning)
    flags.push({ id: "co", severity: "review", title: "Carbon monoxide poisoning", detail: d.death.carboxyhemoglobinPct === null ? "COHb not recorded." : `COHb ${d.death.carboxyhemoglobinPct}%.`, section: "death" })
  if (d.history.cocaine === "yes") flags.push({ id: "cocaine", severity: "review", title: "Cocaine use", detail: "Assess for LVH and coronary disease.", section: "history" })
  if (d.history.amphetamines === "yes") flags.push({ id: "amphetamines", severity: "review", title: "Amphetamine use", detail: "Assess LV function and wall thickness.", section: "history" })
  if (d.history.knownCad === "yes") flags.push({ id: "cad", severity: "review", title: "Known coronary disease", detail: "Review angiography.", section: "coronary" })
  if (d.donation.type === "dcd") flags.push({ id: "dcd", severity: "info", title: "DCD donor", detail: "Check recovery method and warm ischemia times.", section: "donation" })
  if (d.history.phsRiskCriteria.length)
    flags.push({ id: "phs", severity: "info", title: `PHS increased-risk (${d.history.phsRiskCriteria.length})`, detail: "Requires informed consent and NAT testing.", section: "history" })
  if (d.hemodynamics.vasoactives.length >= c.donor.vasoactiveAgentsReviewMin)
    flags.push({ id: "vasoactives", severity: "review", title: `${d.hemodynamics.vasoactives.length} vasoactive agents`, detail: "High support requirement.", section: "hemodynamics" })
  for (const [test, result] of Object.entries(d.infection.serology))
    if (result === "positive")
      flags.push({ id: `serology.${test}`, severity: "review", title: `${labelOf(DONOR_TESTS, test)} positive`, detail: "Check candidate acceptance settings.", section: "infection" })
  return flags
}
```

Typecheck confirms the field paths (`d.hemodynamics.vasoactives`, `c.donor.vasoactiveAgentsReviewMin`, `c.donor.cprMinutesReview`). If one differs, use the actual path shown by the compiler error; the test intent does not change. Add `patientRiskFlags` in the same style: MCS device, high cPRA (≥ the immunology review threshold in criteria), PVR above the size-rule threshold, unacceptable antigens present, ABO not verified on two samples, and listing status expiring within 7 days. Give it tests in the same file.

Run: `bunx vitest run src/domain`
Expected: PASS.

- [ ] **Step 4: Donor detail page**

Rewrite the body of `src/routes/donors/$donorId.index.tsx`:

```tsx
const tabSearch = z.object({ tab: z.enum(["overview", "record", "matches"]).optional().catch(undefined) })

export const Route = createFileRoute("/donors/$donorId/")({
  validateSearch: tabSearch,
  loader: async ({ context, params }) => {
    const qc = context.queryClient
    void qc.prefetchQuery(matchQueries.list({ donorId: params.donorId, order: "recent" }))
    void qc.prefetchQuery(matchingQueries.history({ subjectId: params.donorId }))
    await Promise.all([
      ensureOrNotFound(qc.ensureQueryData(donorQueries.detail(params.donorId))),
      qc.ensureQueryData(criteriaQueries.latest()),
    ])
  },
  pendingComponent: DetailPageSkeleton,
  component: DonorDetail,
})
```

Layout:
- **Header:** title = donor code (font-mono). Badges: state, ABO, `{age} y · {sex}`, donation type. Description: `{hospital} · {opo} · referred {date}`. Actions: `RecordActions` (Task 9).
- **`Tabs`**, with value from `search.tab ?? "overview"`; `onValueChange` navigates with `replace: true`:
  - **Overview** (two columns at lg):
    - Left: a "Key facts" card (definition list: cause/mechanism of death, cardiac arrest/CPR, LVEF (repeat or initial), echo date, vasoactives count, troponin peak, sodium latest), then `DonorDerived` (BMI, BSA, PHM).
    - Right: a "Risk flags" card. Each flag shows an icon and colour by severity (status tokens, always with a word), plus an "Edit" link to the section. With no flags it reads "No risk flags from recorded data". Below it, a "Data completeness" card: the count of clinically relevant blank fields, taken from `leafPaths` intersected with the field spec (blank = `isBlank`), with the top 5 missing as links to `edit#section`. Below that, the "Latest matching" card: the newest run from `matchingQueries.history({ subjectId })` with counts and an Open link, plus a "Rerun matching" button.
  - **Clinical record:** `<RecordView sections={donorRecordSections} record={donor} editLink={{ to: "/donors/$donorId/edit", params: { donorId } }} />`.
  - **Matches:** `useQuery(matchQueries.list({ donorId, order: "recent", ...matchFilters }))`, rendered with `<MatchTable showDonor={false} … />`, plus a `FilterSelect` for overall and a pager. The filters live in the same search object (`overall`, `cursor`).

Mirror this in `src/routes/patients/$patientId.index.tsx`: patient flags, `PatientDerived`/`PatientHemodynamics` in Overview, and `<MatchTable showPatient={false} />`. Delete the old `DonorSummary` 12-field card and its "Use Edit donor to review the complete clinical record" text. Keep `DonorDerived`.

- [ ] **Step 5: Verify**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS.

Manual check:
1. Open a seeded high-risk donor.
   Expected: Overview shows the risk flags; Clinical record shows every section; Matches lists results.
2. Switch tabs and reload.
   Expected: the tab survives the reload (it is in the URL).
3. Click "Edit section" on Echocardiography.
   Expected: the edit page opens scrolled to that section.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): complete donor and patient detail pages with risk flags, full record and matches"
```

---

### Task 12: Patient and donor forms: three-column layout, date picker, dialog guard, typing performance

**Files:**
- Create: `src/components/form/date-picker-field.tsx`, `src/components/form/form-layout.tsx`, `src/components/form/unsaved-guard.tsx`, `src/components/form/use-scroll-spy.ts`
- Modify: `src/components/form/use-form-state.ts`, `src/components/form/index.ts`, `src/components/form/date-field.tsx` (re-export of the picker)
- Modify: `src/components/patient/patient-form.tsx`, `src/components/donor/donor-form.tsx` (split into memoised sections)
- Test: `src/components/form/__tests__/form-state.test.ts`

**Interfaces:**
- Produces:
  - `useFormState<T>(initial, schema)` → `{ value, set, setMany, errors, setErrors, dirty, validate, reset }`, with `set` referentially stable
  - pure `formReducer<T>(state, action)`
  - `DatePickerField(props: DateFieldProps & { captionLayout?: "label" | "dropdown"; fromYear?: number; toYear?: number; disableFuture?: boolean })`
  - `FormLayout({ sections, sectionStatus, rail, children, actions })`
  - `UnsavedGuard({ when })`
  - `useScrollSpy(ids: string[]): string | null`

- [ ] **Step 1: Write the failing form-state test (pure reducer)**

Create `src/components/form/__tests__/form-state.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formReducer, initialFormState } from "../use-form-state"

describe("formReducer", () => {
  const start = initialFormState({ a: { b: 1, c: 2 }, d: "x" })

  it("sets a path, marks dirty, clears that path's errors only", () => {
    const withErrors = { ...start, errors: { "a.b": "bad", d: "bad" } }
    const next = formReducer(withErrors, { type: "set", path: "a.b", value: 5 })
    expect(next.value.a.b).toBe(5)
    expect(next.dirty).toBe(true)
    expect(next.errors).toEqual({ d: "bad" })
  })

  it("keeps untouched branches referentially equal (memoised sections skip re-render)", () => {
    const next = formReducer(start, { type: "set", path: "d", value: "y" })
    expect(next.value.a).toBe(start.value.a)
  })

  it("reset clears dirty and errors", () => {
    const dirty = formReducer(start, { type: "set", path: "d", value: "y" })
    const reset = formReducer(dirty, { type: "reset", value: dirty.value })
    expect(reset.dirty).toBe(false)
    expect(reset.errors).toEqual({})
  })
})
```

Run: `bunx vitest run src/components/form`
Expected: FAIL.

- [ ] **Step 2: Rewrite `use-form-state.ts`**

```ts
import { useCallback, useReducer } from "react"
import type { z } from "zod"
import { updateAtPath } from "./form-helpers"
import type { Path, PathValue } from "./form-helpers"

export type { Path, PathValue } from "./form-helpers"

type State<T> = { value: T; errors: Record<string, string>; dirty: boolean }
type Action<T> =
  | { type: "set"; path: string; value: unknown }
  | { type: "errors"; errors: Record<string, string> }
  | { type: "reset"; value: T }

export const initialFormState = <T,>(value: T): State<T> => ({ value, errors: {}, dirty: false })

/** O(depth) per keystroke: updateAtPath copies only the changed branch; no JSON.stringify. */
export function formReducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "set": {
      const errors = Object.fromEntries(
        Object.entries(state.errors).filter(([k]) => k !== action.path && !k.startsWith(`${action.path}.`))
      )
      return { value: updateAtPath(state.value, action.path as Path<T>, action.value as never), errors, dirty: true }
    }
    case "errors":
      return { ...state, errors: action.errors }
    case "reset":
      return initialFormState(action.value)
  }
}

export function useFormState<T>(initial: T, schema: z.ZodType<T>) {
  const [state, dispatch] = useReducer(formReducer<T>, initial, initialFormState)
  // Stable identity: memoised sections receive the same `set` on every render.
  const set = useCallback(<P extends Path<T>>(path: P, value: PathValue<T, P>) => dispatch({ type: "set", path, value }), [])
  const setErrors = useCallback((errors: Record<string, string>) => dispatch({ type: "errors", errors }), [])
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), [])
  const validate = (): T | null => {
    const result = schema.safeParse(state.value)
    if (result.success) {
      setErrors({})
      return result.data
    }
    const next: Record<string, string> = {}
    for (const issue of result.error.issues) next[issue.path.join(".")] ??= issue.message
    setErrors(next)
    return null
  }
  return { value: state.value, errors: state.errors, dirty: state.dirty, set, setErrors, validate, reset }
}
```

Confirm `updateAtPath` copies only the changed branch: `sed -n 1,60p src/components/form/form-helpers.ts`. If it uses `structuredClone` on the whole object, rewrite it as a recursive spread along the path. The reducer test "keeps untouched branches referentially equal" enforces this.

The blocker moves out of this hook into `UnsavedGuard` (Step 4), so the hook no longer imports the router.

Run: `bunx vitest run src/components/form`
Expected: PASS.

- [ ] **Step 3: Date picker field**

Create `src/components/form/date-picker-field.tsx`:

```tsx
import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseIsoDate } from "@/domain/dates"
import { FieldFrame, useField } from "./field-frame"
import type { DateFieldProps } from "./date-field"

const pad = (n: number) => String(n).padStart(2, "0")
/** Calendar days are UTC midnights in the domain (parseIsoDate). Keep the picker in the same frame. */
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromPicker = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
const toPicker = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

export function DatePickerField(
  props: DateFieldProps & { captionLayout?: "label" | "dropdown"; fromYear?: number; toYear?: number; disableFuture?: boolean }
) {
  const field = useField(props)
  const [open, setOpen] = useState(false)
  const parsed = props.value ? parseIsoDate(props.value) : null
  const selected = parsed ? toPicker(parsed) : undefined
  const today = new Date()
  const min = props.min ? parseIsoDate(props.min) : null
  const max = props.max ? parseIsoDate(props.max) : null
  return (
    <FieldFrame {...props} id={field.id}>
      <div className="flex gap-1">
        {/* Typed entry stays available: fastest for clinicians with a date in hand. */}
        <Input {...field} type="date" value={props.value} min={props.min} max={props.max ?? (props.disableFuture ? toIso(fromPicker(today)) : undefined)}
          disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)} className="flex-1" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button type="button" variant="outline" size="icon" disabled={props.disabled} aria-label={`Pick ${props.label}`} />}>
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              captionLayout={props.captionLayout ?? "dropdown"}
              startMonth={new Date(props.fromYear ?? 1900, 0)}
              endMonth={new Date(props.toYear ?? today.getFullYear() + 1, 11)}
              disabled={[
                ...(props.disableFuture ? [{ after: today }] : []),
                ...(min ? [{ before: toPicker(min) }] : []),
                ...(max ? [{ after: toPicker(max) }] : []),
              ]}
              onSelect={(d) => {
                if (!d) return
                props.onChange(toIso(fromPicker(d)))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </FieldFrame>
  )
}
```

Verify the domain convention first: `grep -n "export function parseIsoDate" -A10 src/domain/dates.ts`. If it returns a local-midnight `Date`, drop the UTC conversions (`fromPicker`/`toPicker` become identity and `toIso` uses local getters). The rule is that the picker and the domain must use the same frame; the round-trip test below enforces it.

Add to `src/components/form/__tests__/form-helpers.test.ts`:

```ts
import { parseIsoDate } from "@/domain/dates"
it("date picker round-trips ISO dates across DST boundaries", () => {
  for (const iso of ["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01", "2024-02-29"]) {
    const d = parseIsoDate(iso)!
    const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    const back = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))
    expect(back.toISOString().slice(0, 10)).toBe(iso)
  }
})
```

`react-day-picker` 10 is installed, and `calendar.tsx` was generated for it and typechecks. The props used (`mode`, `selected`, `captionLayout`, `startMonth`, `endMonth`, `disabled` matchers) exist in v9 and v10. If typecheck reports a renamed prop, follow the compiler.

Make `DateField` an alias, so every existing call site upgrades at once: in `src/components/form/date-field.tsx`, keep `DateFieldProps` and replace the component body with `return <DatePickerField {...props} />`. For dates of birth, pass `captionLayout="dropdown"` and `disableFuture`. For the listing, status, echo, titer and other clinical event dates, pass `disableFuture`. For `statusExpiresOn`, allow future dates.

- [ ] **Step 4: Unsaved-changes guard with a dialog**

Create `src/components/form/unsaved-guard.tsx`:

```tsx
import { useBlocker } from "@tanstack/react-router"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function UnsavedGuard({ when }: { when: boolean }) {
  const blocker = useBlocker({ shouldBlockFn: () => when, enableBeforeUnload: when, withResolver: true })
  return (
    <AlertDialog open={blocker.status === "blocked"} onOpenChange={(open) => !open && blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your edits on this page have not been saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>Discard</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Replace the `window.confirm` blocker in `/matches/check` with `<UnsavedGuard when={dirty} />` as well.

- [ ] **Step 5: Three-column layout with scroll-spy**

Create `src/components/form/use-scroll-spy.ts`:

```ts
import { useEffect, useState } from "react"

/** One IntersectionObserver for all sections: O(1) work per scroll frame, no scroll listeners. */
export function useScrollSpy(ids: ReadonlyArray<string>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  useEffect(() => {
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Infinity)
        const top = [...visible].filter(([, y]) => y !== Infinity).sort((a, b) => a[1] - b[1])[0]
        if (top) setActive(top[0])
      },
      { rootMargin: "-80px 0px -60% 0px" }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])
  return active
}
```

Create `src/components/form/form-layout.tsx`:

```tsx
import type { ReactNode } from "react"
import { Check, CircleAlert, CircleDashed } from "lucide-react"
import { cn } from "cn"
import { useScrollSpy } from "./use-scroll-spy"

export type SectionStatus = { errors: number; missing: number }

export function FormLayout({
  sections, status, rail, actions, children,
}: {
  sections: ReadonlyArray<{ id: string; title: string }>
  status: Record<string, SectionStatus>
  rail: ReactNode
  actions: ReactNode
  children: ReactNode
}) {
  const active = useScrollSpy(sections.map((s) => s.id))
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,768px)_300px] xl:justify-center">
      <nav aria-label="Form sections" className="-mx-4 overflow-x-auto px-4 xl:sticky xl:top-20 xl:mx-0 xl:self-start xl:overflow-visible xl:px-0">
        <ol className="flex gap-1 xl:flex-col">
          {sections.map((s) => {
            const st = status[s.id] ?? { errors: 0, missing: 0 }
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-current={active === s.id ? "location" : undefined}
                  className={cn("flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted",
                    active === s.id && "border-primary bg-muted font-medium")}
                >
                  {st.errors ? <CircleAlert className="size-3.5 text-destructive" aria-label={`${st.errors} errors`} />
                    : st.missing ? <CircleDashed className="size-3.5 text-muted-foreground" aria-label={`${st.missing} not recorded`} />
                    : <Check className="size-3.5 text-muted-foreground" aria-label="Complete" />}
                  {s.title}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="min-w-0 space-y-6">{children}</div>
      <aside className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
        <div className="space-y-4">
          {rail}
          <div className="flex gap-2">{actions}</div>
        </div>
      </aside>
      {/* Below xl: sticky action bar so Save is always reachable. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t bg-background/95 p-3 backdrop-blur xl:hidden">{actions}</div>
    </div>
  )
}
```

Between 1024 and 1279 px, render `rail` inside a `Collapsible` card above the first section. Do this inside the form component (`<div className="xl:hidden">`) so `FormLayout` stays simple.

- [ ] **Step 6: Split the forms into memoised sections**

The pattern, shown for `patient-form.tsx` (apply it to all 15 patient and 14 donor sections):

```tsx
type SectionProps<K extends keyof Patient> = {
  value: Patient[K]
  errors: Record<string, string> // already filtered to this section, keys without the prefix
  set: <P extends Path<Patient>>(path: P, value: PathValue<Patient, P>) => void
}

const IdentitySection = memo(function IdentitySection({ value: v, errors, set }: SectionProps<"identity">) {
  return (
    <FormSection id="identity" title="Identity">
      <TextField label="Medical record number" value={v.mrn} onChange={(x) => set("identity.mrn", x)} error={errors.mrn} />
      {/* …the existing fields, unchanged except that p.identity.* → v.* and form.errors["identity.x"] → errors.x */}
    </FormSection>
  )
})
```

Section errors must be memoised per section, so a section re-renders only when its own errors change:

```tsx
function useSectionErrors(errors: Record<string, string>, ids: ReadonlyArray<string>) {
  return useMemo(() => {
    const out: Record<string, Record<string, string>> = Object.fromEntries(ids.map((id) => [id, {}]))
    for (const [k, msg] of Object.entries(errors)) {
      const [head, ...rest] = k.split(".")
      if (out[head]) out[head][rest.join(".") || head] = msg
    }
    return out
  }, [errors, ids])
}
```

`errors` changes only on validate or on the first edit of a field that has an error, so this runs rarely. An unchanged section receives the same `value` object (thanks to the reducer's structural sharing), the same `set`, and the same errors object. To keep the errors object stable, return the previous inner object when its contents are unchanged: compare with a shallow key/value check inside the `useMemo`, using a `useRef` cache.

Rail content for patients: `PatientDerived` (age, BMI, BSA, PHM) and `PatientHemodynamics` (TPG, PVR); a completeness meter (`Progress` value = recorded/total clinically relevant fields, reusing `leafPaths` from Task 11); and a validation summary (`<ul>` of `form.errors` entries; each item is a button that focuses `document.getElementById(fieldId)`). Donors: `DonorDerived` plus the same meter and summary.

Actions: `<SubmitButton pending={saving}>Save patient</SubmitButton>`, plus `<Button variant="outline" nativeButton={false} render={<Link to=… />}>Cancel</Button>` and the dirty indicator text. Render `<UnsavedGuard when={form.dirty && !saving} />` once.

On mount, if `location.hash` names a section, scroll to it. This makes Task 11's "Edit section" links land correctly: `useEffect(() => { const id = window.location.hash.slice(1); if (id) document.getElementById(id)?.scrollIntoView() }, [])`.

- [ ] **Step 7: Swap the date filters on match results**

In `/matches/`, replace the `DateField`s for `from`/`to` with `DatePickerField` (`disableFuture`, `captionLayout="label"`) inside the toolbar, at `w-44`.

- [ ] **Step 8: Verify, including the typing budget**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS.

Manual check:
1. Open `/patients/new` at 1440 px.
   Expected: three columns; scroll-spy follows the scroll; the rail stays visible.
2. Open React DevTools → Profiler → "Highlight updates" and type in MRN.
   Expected: only the Identity section highlights.
3. In the Performance panel, record 10 keystrokes.
   Expected: each commit ≤ 16 ms.
4. Pick dates with the calendar and also type them.
   Expected: both produce the same ISO value.
5. Navigate away while the form is dirty.
   Expected: the dialog appears; "Keep editing" stays; "Discard" leaves.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(forms): three-column layout, shadcn date picker, dialog guard, memoised sections"
```

---

### Task 13: Result view redesign, Check a pair, shadcn accordions

**Files:**
- Move: `src/components/evaluation/*` → `src/components/match/*` (`git mv`, then fix imports)
- Rewrite: `src/components/match/result-view.tsx`, `src/components/match/rule-card.tsx`
- Create: `src/components/match/verdict-bar.tsx`, `src/components/match/missing-data-table.tsx`, `src/components/match/decision-panel.tsx`, `src/domain/missing-fields.ts`
- Modify: `src/components/criteria/criteria-history.tsx`, `src/routes/matches/$matchId.tsx`, `src/routes/matches/check.tsx`
- Test: `src/domain/__tests__/missing-fields.test.ts`

**Interfaces:**
- Produces:
  - `RULE_TITLES: Record<RuleId, string>`
  - `missingFieldTarget(rule: RuleId, findingCode: string): { entity: "patient" | "donor" | "pair"; section: string }`
  - `ResultView({ detail, mode }: { detail: ResultInput; mode: "saved" | "preview" })`, where `ResultInput = Pick<MatchDetail, "result" | "patient" | "donor" | "pair" | "criteria" | "criteriaVersion"> & Partial<Pick<MatchDetail, "id" | "source" | "outOfDate" | "createdAt" | "decision">>`

- [ ] **Step 1: Missing-field routing (failing test first)**

Every missing finding needs a "Fix" link to the exact form section. List the codes the engine can emit with `missing: true`:

Run: `grep -rhoE 'code: "[a-zA-Z.]+"' src/domain/rules | sort -u`

Create `src/domain/__tests__/missing-fields.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../criteria"
import { evaluate } from "../engine"
import { defaultPairInputs, emptyDonor, emptyPatient } from "../factories"
import { missingFieldTarget } from "../missing-fields"

describe("missingFieldTarget", () => {
  it("routes every missing finding from blank records to a real form section", () => {
    const r = evaluate({ patient: emptyPatient(), donor: emptyDonor(), pair: defaultPairInputs(), criteria: DEFAULT_CRITERIA })
    const missing = r.rules.flatMap((rule) => rule.findings.filter((f) => f.missing).map((f) => ({ rule: rule.rule, code: f.code })))
    expect(missing.length).toBeGreaterThan(0)
    for (const m of missing) {
      const t = missingFieldTarget(m.rule, m.code)
      expect(t.section, `${m.rule}/${m.code}`).not.toBe("")
    }
  })
})
```

Create `src/domain/missing-fields.ts`:

```ts
import type { RuleId } from "./schema"

type Target = { entity: "patient" | "donor" | "pair"; section: string }

/** Prefix table: the most specific prefix wins. Section ids match the form section ids. */
// Codes taken from evaluate(emptyPatient, emptyDonor) on the current engine (ENGINE_VERSION 1.0.0).
const TABLE: ReadonlyArray<[prefix: string, target: Target]> = [
  ["abo.missing", { entity: "patient", section: "blood" }],
  ["abo.titerDate", { entity: "patient", section: "blood" }],
  ["abo.verification", { entity: "patient", section: "blood" }],
  ["abo.age", { entity: "patient", section: "identity" }],
  ["size.age", { entity: "patient", section: "identity" }],
  ["immunology.cpra", { entity: "patient", section: "sensitization" }],
  ["immunology.specificities", { entity: "patient", section: "sensitization" }],
  ["immunology.donorTyping", { entity: "donor", section: "hla" }],
  ["infection.missing.recipient", { entity: "patient", section: "serology" }],
  ["infection.missing.chagasEndemicBirth", { entity: "donor", section: "history" }],
  ["infection.missing", { entity: "donor", section: "infection" }],
  ["donorHeart.age", { entity: "donor", section: "identity" }],
  ["donorHeart.lvef", { entity: "donor", section: "echo" }],
  ["donorHeart.wallThickness", { entity: "donor", section: "echo" }],
  ["donorHeart.wallMotion", { entity: "donor", section: "echo" }],
  ["donorHeart.valveDisease", { entity: "donor", section: "echo" }],
  ["donorHeart.rvFunction", { entity: "donor", section: "echo" }],
  ["donorHeart.congenitalAbnormality", { entity: "donor", section: "echo" }],
  ["donorHeart.coronaryAnomaly", { entity: "donor", section: "coronary" }],
  ["donorHeart.ecgLvh", { entity: "donor", section: "ecg" }],
  ["donorHeart.sodium", { entity: "donor", section: "labs" }],
  ["donorHeart.troponin", { entity: "donor", section: "labs" }],
  ["donorHeart.cardiacArrest", { entity: "donor", section: "death" }],
  ["donorHeart", { entity: "donor", section: "history" }], // knownCad, priorMi, cocaine, diabetes, smoking, malignancy…
  ["logistics.priorSternotomies", { entity: "patient", section: "history" }],
  ["logistics.donorAge", { entity: "donor", section: "identity" }],
  ["logistics", { entity: "pair", section: "pair-inputs" }],
]

const FALLBACK: Record<RuleId, Target> = {
  abo: { entity: "patient", section: "blood" },
  size: { entity: "patient", section: "body" },
  immunology: { entity: "patient", section: "sensitization" },
  infection: { entity: "donor", section: "infection" },
  donorHeart: { entity: "donor", section: "echo" },
  logistics: { entity: "pair", section: "pair-inputs" },
}

export function missingFieldTarget(rule: RuleId, code: string): Target {
  let best: Target | null = null
  let bestLen = -1
  for (const [prefix, target] of TABLE)
    if (code.startsWith(prefix) && prefix.length > bestLen) {
      best = target
      bestLen = prefix.length
    }
  return best ?? FALLBACK[rule]
}
```

The table covers every missing-data code the engine emits today. If the grep shows a code with no specific prefix, add a row that points at the section where the clinician enters that input. The fallback stops a gap from crashing anything, but it can send the user to the wrong section, so the table must be kept complete.

Run: `bunx vitest run src/domain/__tests__/missing-fields.test.ts`
Expected: PASS.

- [ ] **Step 2: Move the folder and add rule titles**

```bash
git mv src/components/evaluation src/components/match
grep -rl "components/evaluation" src | xargs sed -i 's#components/evaluation#components/match#g'
```

Step 3 rewrites `rule-card.tsx` and adds the exported `RULE_TITLES` map.

- [ ] **Step 3: Rule accordion with readable findings**

Rewrite `src/components/match/rule-card.tsx`:

```tsx
import { useState } from "react"
import type { Finding, RuleId, RuleResult } from "@/domain/schema"
import { StatusBadge, StatusIcon } from "@/components/app/status"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

export function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-t py-3 first:border-t-0">
      <StatusIcon status={finding.status} missing={finding.missing} className="mt-0.5" />
      <div className="max-w-[72ch] space-y-1.5">
        <p className="text-sm font-medium">{finding.title}</p>
        <p className="text-sm leading-relaxed text-foreground/90">{finding.detail}</p>
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <dt>Evidence</dt>
          <dd className="text-foreground/80">{finding.evidence || "Not recorded"}</dd>
          <dt>Source</dt>
          <dd>{finding.source}</dd>
        </dl>
      </div>
    </li>
  )
}

const tally = (findings: Finding[]) => {
  const n = (s: Finding["status"]) => findings.filter((f) => f.status === s).length
  return [n("fail") && `${n("fail")} fail`, n("review") && `${n("review")} review`, n("pass") && `${n("pass")} pass`, n("info") && `${n("info")} info`]
    .filter(Boolean).join(" · ")
}

export function RuleAccordionItem({ rule }: { rule: RuleResult }) {
  const [showInfo, setShowInfo] = useState(false)
  const main = rule.findings.filter((f) => f.status !== "info")
  const info = rule.findings.filter((f) => f.status === "info")
  return (
    <AccordionItem value={rule.rule} id={`rule-${rule.rule}`} className="scroll-mt-24 border bg-card px-4">
      <AccordionTrigger className="py-3 hover:no-underline">
        <span className="flex flex-1 flex-wrap items-center gap-3 text-left">
          <span className="text-base font-semibold">{RULE_TITLES[rule.rule]}</span>
          <StatusBadge status={rule.status} />
          <span className="text-xs font-normal text-muted-foreground">{tally(rule.findings)}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <ul>{main.map((f) => <FindingRow key={f.code} finding={f} />)}</ul>
        {info.length > 0 && (
          <>
            <Button variant="link" size="sm" className="px-0" onClick={() => setShowInfo((v) => !v)} aria-expanded={showInfo}>
              {showInfo ? "Hide" : "Show"} {info.length} info finding{info.length > 1 ? "s" : ""}
            </Button>
            {showInfo && <ul>{info.map((f) => <FindingRow key={f.code} finding={f} />)}</ul>}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

export const RULE_TITLES: Record<RuleId, string> = {
  abo: "Blood type", size: "Size", immunology: "HLA and antibodies",
  infection: "Infection", donorHeart: "Donor heart", logistics: "Ischemic time and logistics",
}
```

If `StatusIcon` does not accept `className`, add a passthrough to it in `src/components/app/status.tsx` (it is app code, not vendored).

- [ ] **Step 4: Verdict bar, missing-data table, decision panel**

Create `src/components/match/verdict-bar.tsx`:

```tsx
import type { RuleId, RuleResult } from "@/domain/schema"
import { StatusBadge, StatusIcon } from "@/components/app/status"
import { Badge } from "@/components/ui/badge"
import { RULE_TITLES } from "./rule-card"

export function VerdictBar({
  overall, patientName, donorCode, sourceLabel, criteriaVersion, engineVersion, outOfDate, rules, onRule,
}: {
  overall: RuleResult["status"]; patientName: string; donorCode: string; sourceLabel: string
  criteriaVersion: number; engineVersion: string; outOfDate: boolean; rules: RuleResult[]; onRule: (id: RuleId) => void
}) {
  return (
    <section aria-label="Overall result" className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusBadge status={overall} className="text-sm" />
        <h1 className="text-lg font-semibold">{patientName} <span className="text-muted-foreground">↔</span> <span className="font-mono">{donorCode}</span></h1>
        <span className="text-xs text-muted-foreground">{sourceLabel} · criteria v{criteriaVersion} · engine {engineVersion}</span>
        {outOfDate && <Badge variant="outline">Out of date: records or criteria changed</Badge>}
      </div>
      <nav aria-label="Rule groups" className="mt-3 flex flex-wrap gap-2">
        {rules.map((r) => (
          <button key={r.rule} type="button" onClick={() => onRule(r.rule)}
            className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-2">
            <StatusIcon status={r.status} /> {RULE_TITLES[r.rule]}
          </button>
        ))}
      </nav>
      <p className="mt-2 text-xs text-muted-foreground">The app advises; the clinician makes the final decision.</p>
    </section>
  )
}
```

Create `src/components/match/missing-data-table.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import type { Finding, RuleId } from "@/domain/schema"
import { missingFieldTarget } from "@/domain/missing-fields"
import { RULE_TITLES } from "./rule-card"

export function MissingDataTable({ items, patientId, donorId, onPairFix }: {
  items: Array<{ rule: RuleId; finding: Finding }>; patientId: string; donorId: string; onPairFix: () => void
}) {
  if (!items.length) return null
  return (
    <section aria-labelledby="missing-data" className="border">
      <h2 id="missing-data" className="border-b bg-muted px-4 py-2 text-sm font-semibold">Missing data ({items.length}): these findings stay REVIEW until recorded</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Field</th><th className="px-4 py-2 font-medium">Rule</th><th className="px-4 py-2 font-medium">Fix</th></tr></thead>
        <tbody>
          {items.map(({ rule, finding }) => {
            const t = missingFieldTarget(rule, finding.code)
            return (
              <tr key={finding.code} className="border-t">
                <td className="px-4 py-2">{finding.title}</td>
                <td className="px-4 py-2 text-muted-foreground">{RULE_TITLES[rule]}</td>
                <td className="px-4 py-2">
                  {t.entity === "pair" ? (
                    <button type="button" className="underline" onClick={onPairFix}>Enter pair inputs</button>
                  ) : t.entity === "patient" ? (
                    <Link to="/patients/$patientId/edit" params={{ patientId }} hash={t.section} className="underline">Edit patient · {t.section}</Link>
                  ) : (
                    <Link to="/donors/$donorId/edit" params={{ donorId }} hash={t.section} className="underline">Edit donor · {t.section}</Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
```

Create `src/components/match/decision-panel.tsx`, which wraps the existing `decision-form.tsx`:
- **`detail.source === "screening"`:** a card titled "Screening result". It explains that pair inputs (distance, ischemia, crossmatch) were blank, so a decision is not available. It has a primary button, "Complete this match", linking to `/matches/check` with `search={{ patientId, donorId }}`.
- **`detail.decision`:** a read-only decision card (verdict, clinician, rationale, reasons, decided at).
- **Otherwise:** `<DecisionForm match={detail} />`, using `useDecideMatch` and `SubmitButton`.

- [ ] **Step 5: Compose the result view**

Rewrite `src/components/match/result-view.tsx`:

```tsx
import { useState } from "react"
import type { MatchDetail } from "@/domain/match-types"
import type { RuleId } from "@/domain/schema"
import { Accordion } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OctagonX } from "lucide-react"
import { FindingRow, RuleAccordionItem } from "./rule-card"
import { VerdictBar } from "./verdict-bar"
import { MissingDataTable } from "./missing-data-table"
import { SideBySide } from "./side-by-side"
import { IschemiaBreakdown } from "./ischemia-breakdown"
import { PairInputsSummary } from "./pair-inputs-summary"
import { DecisionPanel } from "./decision-panel"

export type ResultInput = Pick<MatchDetail, "result" | "patient" | "donor" | "pair" | "criteria" | "criteriaVersion"> &
  Partial<Pick<MatchDetail, "id" | "source" | "outOfDate" | "createdAt" | "decision" | "patientId" | "donorId">>

export function ResultView({ detail, mode, onPairFix }: { detail: ResultInput; mode: "saved" | "preview"; onPairFix: () => void }) {
  const { result, patient, donor } = detail
  // FAIL and REVIEW rules start open; PASS rules start collapsed.
  const [open, setOpen] = useState<RuleId[]>(() => result.rules.filter((r) => r.status !== "pass").map((r) => r.rule))
  const [tab, setTab] = useState("findings")
  const missing = result.rules.flatMap((r) => r.findings.filter((f) => f.missing).map((finding) => ({ rule: r.rule, finding })))
  const goToRule = (id: RuleId) => {
    setTab("findings")
    setOpen((prev) => (prev.includes(id) ? prev : [...prev, id]))
    requestAnimationFrame(() => document.getElementById(`rule-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }
  return (
    <div>
      <VerdictBar
        overall={result.overall}
        patientName={`${patient.identity.firstName} ${patient.identity.lastName}`}
        donorCode={donor.identity.donorId}
        sourceLabel={mode === "preview" ? "Live preview (not saved)" : detail.source === "screening" ? "Screening result" : "Checked pair"}
        criteriaVersion={detail.criteriaVersion}
        engineVersion={result.engineVersion}
        outOfDate={detail.outOfDate ?? false}
        rules={result.rules}
        onRule={goToRule}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {result.blockers.length > 0 && (
            <Alert variant="destructive">
              <OctagonX aria-hidden="true" />
              <AlertTitle>Blockers</AlertTitle>
              <AlertDescription><ul>{result.blockers.map((f) => <FindingRow key={f.code} finding={f} />)}</ul></AlertDescription>
            </Alert>
          )}
          <MissingDataTable items={missing} patientId={patient.id} donorId={donor.id} onPairFix={onPairFix} />
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="findings">Findings</TabsTrigger>
              <TabsTrigger value="compare">Patient vs donor</TabsTrigger>
              <TabsTrigger value="logistics">Pair inputs &amp; ischemia</TabsTrigger>
            </TabsList>
            <TabsContent value="findings" className="pt-4">
              <Accordion multiple value={open} onValueChange={(v) => setOpen(v as RuleId[])} className="gap-3">
                {result.rules.map((r) => <RuleAccordionItem key={r.rule} rule={r} />)}
              </Accordion>
            </TabsContent>
            <TabsContent value="compare" className="pt-4"><SideBySide patient={patient} donor={donor} /></TabsContent>
            <TabsContent value="logistics" className="space-y-4 pt-4">
              <PairInputsSummary pair={detail.pair} />
              <IschemiaBreakdown pair={detail.pair} patient={patient} criteria={detail.criteria} />
            </TabsContent>
          </Tabs>
        </div>
        {mode === "saved" && detail.id && (
          <aside className="xl:sticky xl:top-40 xl:self-start"><DecisionPanel detail={detail as MatchDetail} /></aside>
        )}
      </div>
    </div>
  )
}
```

Create `src/components/match/pair-inputs-summary.tsx` from the "Frozen pair inputs" `<dl>` in the old result view: the same eight rows, rendered as a two-column definition list with `text-xs` labels and `font-medium` values.

- [ ] **Step 6: Routes**

- **`/matches/$matchId`:** `const { data } = useSuspenseQuery(matchQueries.detail(matchId))`, then `<ResultView detail={data} mode="saved" onPairFix={() => navigate({ to: "/matches/check", search: { patientId: data.patientId, donorId: data.donorId }, hash: "pair-inputs" })} />`.
- **`/matches/check`:**
  - Layout: the pair picker row on top, then a two-column body at xl (left: `PairInputsForm` with `id="pair-inputs"`; right: the preview).
  - The preview computes `evaluate()` from `useDeferredValue(pair)`, so typing stays at 60 fps.
  - `<ResultView detail={{ result, patient, donor, pair, criteria, criteriaVersion }} mode="preview" onPairFix={() => document.getElementById("pair-inputs")?.scrollIntoView({ behavior: "smooth" })} />`.
  - Save: `useCheckPair().mutateAsync`, then navigate to `/matches/$matchId`. Show `SubmitButton` pending.
  - Unsaved guard: `<UnsavedGuard when={dirty && !check.isPending} />`.

- [ ] **Step 7: Replace the criteria-history accordion**

Rewrite the list in `src/components/criteria/criteria-history.tsx`:

```tsx
import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
// …
const [open, setOpen] = useState<string[]>([])
// …
<Accordion value={open} onValueChange={(v) => setOpen(v as string[])} className="border">
  {sorted.map((version, index) => (
    <AccordionItem key={version.id} value={version.id} className="px-4">
      <AccordionTrigger className="hover:no-underline">
        <span className="flex flex-wrap items-baseline gap-x-3 text-left">
          <span className="font-semibold">Version {version.version}</span>
          <span className="text-sm text-muted-foreground">{version.author || "Unspecified clinician"}</span>
          <time className="text-sm text-muted-foreground" dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <p className="mb-3 text-sm whitespace-pre-wrap">{version.changeNote}</p>
        {/* Diff renders only when open: no work for collapsed history. */}
        {open.includes(version.id) &&
          (sorted[index + 1] ? <CriteriaDiff before={sorted[index + 1].criteria} after={version.criteria} /> : <p className="text-sm">Initial criteria version.</p>)}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

Run: `grep -rn "<details\|<summary" src --include=*.tsx`
Expected: no output.

- [ ] **Step 8: Verify**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: PASS.

Manual check:
1. Open a seeded result with blockers and missing data at 1280, 1440 and 1920 px.
   Expected: the verdict bar stays pinned; the rule chips open and scroll to their rules; evidence and source line up in one column; the decision panel is pinned on the right at xl.
2. Open a screening result.
   Expected: it shows "Complete this match" and no decision form.
3. In Check a pair, type quickly in the distance field.
   Expected: no jank.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): readable result view with verdict bar, missing-data fixes, shadcn accordions"
```

---

## Phase 4: Data and quality

### Task 14: Realistic, scenario-complete demo dataset

**Files:**
- Create: `src/domain/demo-data/index.ts`, `src/domain/demo-data/people.ts`, `src/domain/demo-data/patients.ts`, `src/domain/demo-data/donors.ts`, `src/domain/demo-data/scenarios.ts`
- Test: `src/domain/demo-data/__tests__/coverage.test.ts`
- Modify: `src/domain/sample-data.ts` (keep it only for the existing engine tests: rename identifiers to neutral `TEST-*` values and remove "Fictional"), `src/domain/__tests__/sample-data.test.ts` if it asserts strings
- Create: `scripts/seed.ts`; add the `db:seed` script

**Interfaces:**
- Produces:
  - `DEMO_PATIENTS: Patient[]` (24), `DEMO_DONORS: Donor[]` (12)
  - `demoNow(): Date` (all dates relative to it)
  - `SCENARIOS: ReadonlyArray<Scenario>`, where `Scenario = { id: string; rule: RuleId | "listing"; description: string; patientId: string; donorId: string; expect: (r: EvaluationResult) => boolean }`

- [ ] **Step 1: Write the failing coverage test**

Create `src/domain/demo-data/__tests__/coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_CRITERIA } from "../../criteria"
import { evaluate } from "../../engine"
import { defaultPairInputs } from "../../factories"
import { donorSchema, patientSchema } from "../../schema"
import { DEMO_DONORS, DEMO_PATIENTS, SCENARIOS, demoNow } from ".."

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))

describe("demo dataset", () => {
  it("is schema-valid and sized as specified", () => {
    expect(DEMO_PATIENTS).toHaveLength(24)
    expect(DEMO_DONORS).toHaveLength(12)
    for (const p of DEMO_PATIENTS) patientSchema.parse(p)
    for (const d of DEMO_DONORS) donorSchema.parse(d)
  })

  it("never says fictional and has unique realistic identifiers", () => {
    const text = JSON.stringify([DEMO_PATIENTS, DEMO_DONORS])
    expect(text).not.toMatch(/fictional/i)
    expect(new Set(DEMO_PATIENTS.map((p) => p.identity.mrn)).size).toBe(24)
    expect(new Set(DEMO_DONORS.map((d) => d.identity.donorId)).size).toBe(12)
    for (const d of DEMO_DONORS) expect(d.identity.donorId).toMatch(/^[A-Z]{3,4}\d{3}$/)
    for (const p of DEMO_PATIENTS) expect(p.identity.mrn).toMatch(/^MRN-\d{7}$/)
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))("reaches scenario %s", (_id, s) => {
    const p = byId(DEMO_PATIENTS).get(s.patientId)
    const d = byId(DEMO_DONORS).get(s.donorId)
    expect(p, `patient ${s.patientId}`).toBeDefined()
    expect(d, `donor ${s.donorId}`).toBeDefined()
    const r = evaluate({ patient: p!, donor: d!, pair: defaultPairInputs(), criteria: DEFAULT_CRITERIA, now: demoNow() })
    expect(s.expect(r), s.description).toBe(true)
  })

  it("covers every scenario listed in spec §11.1", () => {
    const required = [
      "abo.identical", "abo.compatible", "abo.incompatible", "abo.pediatric-optin", "abo.pediatric-optout", "abo.unknown", "abo.a2",
      "size.pass", "size.review", "size.fail", "size.female-to-male", "size.pvr", "size.pediatric", "size.missing-height",
      "immunology.none", "immunology.dsa", "immunology.high-cpra-no-dsa", "immunology.missing-hla",
      "infection.clean", "infection.hcv-accepts", "infection.hcv-declines", "infection.hbv-core", "infection.cmv-mismatch", "infection.phs", "infection.missing",
      "donorHeart.normal", "donorHeart.older", "donorHeart.lvef-repeat", "donorHeart.inotropes", "donorHeart.cad", "donorHeart.cocaine", "donorHeart.co", "donorHeart.cpr", "donorHeart.dcd",
      "listing.inactive", "listing.transplanted", "listing.removed",
    ]
    expect(SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(required))
  })
})
```

Positive flow and CDC crossmatches, and the logistics scenarios (short ischemia, over threshold, OCS exclusion, redo addition, missing distance), depend on **pair inputs**, not records. Cover them in `scenarios.ts` with an optional `pair?: Partial<PairInputs>` field on `Scenario`. Merge it over `defaultPairInputs()` in the test, and add those ids to `required` (`immunology.flow-positive`, `immunology.cdc-positive`, `logistics.short`, `logistics.long`, `logistics.ocs`, `logistics.redo`, `logistics.missing-distance`).

Run: `bunx vitest run src/domain/demo-data`
Expected: FAIL.

- [ ] **Step 2: People and the clock**

Create `src/domain/demo-data/people.ts`:

```ts
/** Synthetic records. Names are common given/family names combined at random; no real people. */
export function demoNow(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12))
}

/** ISO date `days` before demoNow (negative = future). Keeps ages and durations valid over time. */
export function daysAgo(days: number): string {
  return new Date(demoNow().getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

/** Date of birth for an age in whole years plus extra days. */
export function bornYearsAgo(years: number, extraDays = 90): string {
  const n = demoNow()
  return new Date(Date.UTC(n.getUTCFullYear() - years, n.getUTCMonth(), n.getUTCDate()) - extraDays * 86_400_000).toISOString().slice(0, 10)
}

export const CENTERS = [
  "Riverside University Medical Center", "Northlake Heart Institute", "St. Brendan's Hospital", "Mercy Valley Medical Center",
] as const
export const OPOS = ["Great Lakes Donor Network", "Sierra Gift of Life", "Heartland Organ Alliance", "Atlantic Donor Services"] as const
export const ATTENDINGS = ["Dr. Priya Raman", "Dr. Marcus Feld", "Dr. Elena Okafor", "Dr. James Whitaker"] as const

export const PATIENT_NAMES: ReadonlyArray<[first: string, last: string]> = [
  ["Maya", "Chen"], ["Daniel", "Okonkwo"], ["Sofia", "Ramirez"], ["Ethan", "Walsh"], ["Aisha", "Rahman"], ["Lucas", "Moreau"],
  ["Grace", "Kim"], ["Mateo", "Silva"], ["Hannah", "Lindqvist"], ["Omar", "Haddad"], ["Chloe", "Nguyen"], ["Samuel", "Adeyemi"],
  ["Isabel", "Costa"], ["Noah", "Fischer"], ["Leila", "Farahani"], ["Jacob", "Brennan"], ["Ava", "Patel"], ["Theo", "Novak"],
  ["Zara", "Mensah"], ["Henry", "Takahashi"], ["Lily", "Ortega"], ["Elijah", "Grant"], ["Mila", "Kowalski"], ["Arjun", "Mehta"],
]
```

- [ ] **Step 3: Build the records**

Create `src/domain/demo-data/patients.ts` and `donors.ts`. Each starts from a fully recorded baseline, similar to the current `sample-data.ts` builders (all serology negative, normal hemodynamics, typing complete), but with `daysAgo()` dates and the names, centres, attendings and codes above. Each record then gets a scenario override. Here are three representative entries in the required style:

```ts
// patients.ts
import { emptyPatient } from "../factories"
import { RECIPIENT_TEST_VALUES } from "../options"
import type { Patient } from "../schema"
import { ATTENDINGS, CENTERS, PATIENT_NAMES, bornYearsAgo, daysAgo, demoNow } from "./people"

function base(i: number, overrides: (p: Patient) => void): Patient {
  const p = emptyPatient(demoNow())
  const [firstName, lastName] = PATIENT_NAMES[i]
  p.id = `demo-patient-${String(i + 1).padStart(2, "0")}`
  Object.assign(p.identity, {
    mrn: `MRN-${String(4_100_000 + i * 7_919).padStart(7, "0")}`, firstName, lastName,
    dateOfBirth: bornYearsAgo(38 + ((i * 7) % 30)), sex: i % 2 ? "male" : "female",
    transplantCenter: CENTERS[i % CENTERS.length], attendingPhysician: ATTENDINGS[i % ATTENDINGS.length],
  })
  Object.assign(p.listing, { state: "active", listingDate: daysAgo(40 + i * 11), urgencyStatus: (["A1", "A2", "A3", "A4", "A6"] as const)[i % 5], statusDate: daysAgo(5 + i * 3) })
  p.body = { heightCm: 160 + ((i * 5) % 30), weightKg: 58 + ((i * 6) % 40) }
  Object.assign(p.blood, { abo: (["O", "A", "B", "AB"] as const)[i % 4], verifiedTwoSamples: true })
  Object.assign(p.hemodynamics, { catheterizationDate: daysAgo(20), paMean: 24, pcwp: 14, cardiacOutput: 4.8 })
  p.history.priorSternotomies = 0
  Object.assign(p.sensitization, { cpra: 0, cpraPeak: 0, cpraDate: daysAgo(14) })
  for (const t of RECIPIENT_TEST_VALUES) p.serology[t] = "negative"
  p.serologyDate = daysAgo(14)
  p.notes = ""
  overrides(p)
  return p
}

export const DEMO_PATIENTS: Patient[] = [
  base(0, (p) => { p.support.device = "va_ecmo"; p.listing.urgencyStatus = "A1"; p.notes = "VA-ECMO day 6 after cardiogenic shock; awaiting offer." }),
  base(1, (p) => {
    p.blood.abo = "A"; p.listing.urgencyStatus = "A2"; p.support.device = "iabp"
    Object.assign(p.sensitization, { cpra: 82, cpraPeak: 88, unacceptableAntigens: ["A24", "B62"] })
    p.notes = "Highly sensitized after two pregnancies; virtual crossmatch required."
  }),
  base(4, (p) => {
    p.identity.dateOfBirth = bornYearsAgo(0, 210); p.listing.urgencyStatus = "P1A"; p.body = { heightCm: 66, weightKg: 7.4 }
    Object.assign(p.blood, { abo: "B", acceptsIncompatible: true, antiATiter: 4, antiBTiter: 4, titerDate: daysAgo(3) })
    p.notes = "Infant with hypoplastic left heart; intended ABO-incompatible pathway consented."
  }),
  // …21 more, one per row of the scenario table in spec §11.1 plus listing states
]
```

Donor codes follow the OPTN-like pattern (`AHFK214`, `BQRT507`, …): three or four capital letters, then three digits. Notes describe the case clinically ("Cardiac arrest with 22 min CPR; repeat echo improved LVEF 38%→55% on day 2."). Never use the word "fictional". The banner and README state that the data is synthetic.

Create `src/domain/demo-data/scenarios.ts`. It holds one `Scenario` per required id, each with a predicate that reads the result. For example:

```ts
const rule = (r: EvaluationResult, id: RuleId) => r.rules.find((x) => x.rule === id)!
const has = (r: EvaluationResult, id: RuleId, code: string) => rule(r, id).findings.some((f) => f.code.startsWith(code))

export const SCENARIOS: ReadonlyArray<Scenario> = [
  { id: "abo.incompatible", rule: "abo", description: "A donor to O recipient fails", patientId: "demo-patient-01", donorId: "demo-donor-03", expect: (r) => rule(r, "abo").status === "fail" },
  { id: "immunology.dsa", rule: "immunology", description: "Unacceptable A24 on donor typing fails", patientId: "demo-patient-02", donorId: "demo-donor-02", expect: (r) => rule(r, "immunology").status === "fail" },
  { id: "logistics.ocs", rule: "logistics", description: "OCS perfusion is excluded from cold ischemia", patientId: "demo-patient-03", donorId: "demo-donor-05",
    pair: { distanceNm: 600, procurementMinutes: 45, transportMinutes: 240, implantMinutes: 60, preservation: "ocs", perfusionMinutes: 300 },
    expect: (r) => rule(r, "logistics").status !== "fail" },
  // …one per required id; prefer status checks, and use `has()` with real codes from the grep in Task 13 Step 1 where status alone is ambiguous
]
```

Use the real preservation enum value for OCS from `PRESERVATION` in `options.ts`.

Create `src/domain/demo-data/index.ts`:

```ts
export { DEMO_PATIENTS } from "./patients"
export { DEMO_DONORS } from "./donors"
export { SCENARIOS } from "./scenarios"
export type { Scenario } from "./scenarios"
export { demoNow } from "./people"
```

This replaces the temporary re-export from Task 7.

Iterate until `bunx vitest run src/domain/demo-data` passes. When a scenario does not trigger, adjust the record, never the predicate: the predicate states clinical intent.

- [ ] **Step 4: Remove "Fictional" from the remaining test fixtures**

In `src/domain/sample-data.ts`: change `mrn: \`FICTIONAL-${index}\`` → `\`TEST-${index}\``; `firstName: "Fictional"` → `"Test"`; centres/hospitals/OPO → `"Test Center"`/`"Test Hospital"`/`"Test OPO"`; `donorId: \`FICTIONAL-D${index}\`` → `\`TSTD${String(index).padStart(3,"0")}\``; and the notes → `""`. Then run `grep -rni "fictional" src README.md`. Update the README wording to "synthetic". Then:

Run: `bun run test`
Expected: PASS. Fix any snapshot or string assertions in `sample-data.test.ts` to the new values.

- [ ] **Step 5: Seed script**

Create `scripts/seed.ts`:

```ts
import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { seedDemo } from "@/server/repos/data.server"
import { env } from "@/server/env.server"

const { pool, db } = createDb(env().DATABASE_URL, { max: 2, statementTimeoutMs: 60_000 })
await runMigrations(db)
const r = await seedDemo(db, "Demo seed")
console.log(`Seeded ${r.patients} patients, ${r.donors} donors; queued ${r.runs} match runs (start the worker to process them).`)
await pool.end()
```

Add `"db:seed": "bun scripts/seed.ts"` to `package.json`.

- [ ] **Step 6: Verify**

Run: `bun run test && bun run test:db && bun run typecheck && bun run lint`
Expected: PASS.

Run: `bun run db:seed && bun run dev`
Expected: `/matching` shows 12 donor runs (fewer if some donors are not `available`) finishing; patient and donor names look real; nothing says "Fictional".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(data): realistic synthetic demo dataset with enforced scenario coverage"
```

---

### Task 15: Performance verification, bundle check, documentation

**Files:**
- Create: `scripts/load-test.ts`, `scripts/check-client-bundle.ts`
- Modify: `package.json`, `README.md`, `docs/specs/2026-11-14-v2-postgres-matching-ux-spec.md` (§3.1 ID type, §6 Postgres 18 and DB name), `docs/plans/2026-11-14-v2-postgres-matching-ux-plan.md` (progress notes)

- [ ] **Step 1: Load generator**

Create `scripts/load-test.ts`. It seeds the **test** database (port 5434) only, so it never touches dev data:

```ts
import { performance } from "node:perf_hooks"
import { createDb } from "@/server/db/client.server"
import { runMigrations } from "@/server/db/migrate.server"
import { env } from "@/server/env.server"
import { ensureInitialCriteria } from "@/server/repos/criteria.server"
import { insertPatient, listPatients } from "@/server/repos/patients.server"
import { insertDonor } from "@/server/repos/donors.server"
import { claimNextRun, enqueueRun } from "@/server/repos/runs.server"
import { processRun } from "@/server/matching/process-run.server"
import { listMatches, getMatch } from "@/server/repos/matches.server"
import { DEMO_DONORS, DEMO_PATIENTS } from "@/domain/demo-data"
import { sql } from "drizzle-orm"

const url = env().TEST_DATABASE_URL
if (!url) throw new Error("TEST_DATABASE_URL required")
const { pool, db } = createDb(url, { max: 8, statementTimeoutMs: 60_000 })
await runMigrations(db)
await db.execute(sql`TRUNCATE decisions, match_results, match_runs, record_snapshots, audit_log, criteria_versions, patients, donors RESTART IDENTITY CASCADE`)
await ensureInitialCriteria(db)

const P = 2_000, D = 500
for (let i = 0; i < P; i++) {
  const t = structuredClone(DEMO_PATIENTS[i % DEMO_PATIENTS.length])
  t.id = `load-p-${i}`; t.identity.mrn = `MRN-${String(9_000_000 + i)}`; t.listing.state = "active"
  await insertPatient(db, t, "load")
}
for (let i = 0; i < D; i++) {
  const t = structuredClone(DEMO_DONORS[i % DEMO_DONORS.length])
  t.id = `load-d-${i}`; t.identity.donorId = `LOAD${String(i).padStart(3, "0")}`; t.identity.state = "available"
  await insertDonor(db, t, "load")
}
await db.execute(sql`ANALYZE`)

async function p95(label: string, n: number, fn: () => Promise<unknown>, budgetMs: number) {
  const times: number[] = []
  for (let i = 0; i < n; i++) { const s = performance.now(); await fn(); times.push(performance.now() - s) }
  times.sort((a, b) => a - b)
  const v = times[Math.floor(n * 0.95)]
  console.log(`${v <= budgetMs ? "PASS" : "FAIL"} ${label}: p95 ${v.toFixed(1)} ms (budget ${budgetMs} ms)`)
  return v <= budgetMs
}

const results: boolean[] = []
results.push(await p95("patients list (search)", 50, () => listPatients(db, { q: "chen" }), 40))
results.push(await p95("patients list (page 3)", 50, async () => {
  const a = await listPatients(db, {}); const b = await listPatients(db, { cursor: a.nextCursor! }); await listPatients(db, { cursor: b.nextCursor! })
}, 120))

const runId = await db.transaction((tx) => enqueueRun(tx, { subjectKind: "donor", subjectId: "load-d-0", subjectLabel: "LOAD000", trigger: "manual", actor: "load" }))
await claimNextRun(db)
const s = performance.now()
await processRun(db, runId)
const rate = P / ((performance.now() - s) / 1000)
console.log(`${rate >= 500 ? "PASS" : "FAIL"} matching throughput: ${rate.toFixed(0)} pairs/s (budget ≥ 500)`)
results.push(rate >= 500)

results.push(await p95("match results list", 50, () => listMatches(db, {}), 40))
const first = (await listMatches(db, { runId, order: "screen" })).items[0]
results.push(await p95("match detail", 50, () => getMatch(db, first.id), 30))

await pool.end()
if (results.includes(false)) process.exit(1)
```

The `--seed-only` flag mentioned in Task 10: when `process.argv.includes("--seed-only")`, exit right after `ANALYZE`, pointing `url` at `DATABASE_URL` instead. Add that branch at the top.

Add `"perf": "bun scripts/load-test.ts"` to `package.json`.

Run: `bun run perf`
Expected: every line `PASS`. If a list misses its budget, run `EXPLAIN (ANALYZE, BUFFERS)` on the generated SQL (enable Drizzle's `logger: true` temporarily) and confirm the index from spec §3.3 is used. If throughput misses, raise `chunkSize` to 100 and measure again. Record the numbers in Step 5.

- [ ] **Step 2: Client bundle guard**

Create `scripts/check-client-bundle.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

const roots = ["dist/client", ".output/public"].filter((d) => { try { return statSync(d).isDirectory() } catch { return false } })
if (!roots.length) throw new Error("Run `bun run build` first.")
const files = roots.flatMap(function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [] })
})
const forbidden = [/drizzle-orm/, /node-postgres/, /pg-protocol/, /DATABASE_URL/]
let failed = false
for (const f of files) {
  const src = readFileSync(f, "utf8")
  for (const re of forbidden) if (re.test(src)) { console.error(`FAIL ${f} contains ${re}`); failed = true }
}
const entry = files.filter((f) => /main|index|client/.test(f)).map((f) => gzipSync(readFileSync(f)).length).reduce((a, b) => a + b, 0)
console.log(`${entry <= 250_000 ? "PASS" : "FAIL"} entry JS gzip ${(entry / 1024).toFixed(1)} KiB (budget 250 KiB)`)
if (failed || entry > 250_000) process.exit(1)
```

Add `"check:bundle": "bun run build && bun scripts/check-client-bundle.ts"`.

Run: `bun run check:bundle`
Expected: PASS. If the entry is too large, find the heavy import with `npx vite-bundle-visualizer` or the build's chunk report. Move `recharts`, `shiki` and `cmdk` behind route-level imports. With autoCodeSplitting on, they should already be split.

- [ ] **Step 3: Browser budgets**

With `bun run build && bun run preview` and the worker running, using the demo data, in Chrome with DevTools Performance:

| Check | How | Budget |
|---|---|---|
| Warm navigation | Hover "Donors" for 300 ms, click, measure click → final paint | ≤ 50 ms, no skeleton |
| Cold navigation | Hard reload `/patients`, click a never-hovered patient | ≤ 300 ms |
| Keystroke in patient form | Record 10 keystrokes in MRN | every commit ≤ 16 ms |
| Check-a-pair preview | Record typing in distance | ≤ 16 ms per frame |
| Web latency during a run | `bun run perf` matching step in one terminal, `autocannon -d 10 http://localhost:3000/patients` in another, compared with idle | ≤ 10 % p95 regression |
| CLS | Navigate across all sidebar items | 0 |
| No document reloads | Network panel filtered to "Doc" while clicking every sidebar item | 0 after the first load |

Record each result (number and pass/fail) in the plan's progress notes. Any failure blocks completion. Fix it and re-measure.

- [ ] **Step 4: Documentation**

Update `README.md`:

- **Requirements:** Bun ≥ 1.4, Podman (with `podman compose`).
- **Run:** `cp .env.example .env`, `bun install --frozen-lockfile`, `bun run db:up`, `bun run db:migrate`, `bun run db:seed` (optional), then `bun run dev` (web on :3000 and the matching worker).
- **Test:** `bun run test` (unit), `bun run test:db` (needs the `postgres-test` container), `bun run perf`, `bun run check:bundle`.
- **Architecture:** a short paragraph plus the spec §1 diagram, and a link to the v2 spec.
- **Backups:** `podman compose exec postgres pg_dump -U postgres main > backup.sql` and restore with `psql`. The in-app export is a record-level JSON for review, and the in-app import accepts v1 browser exports.
- **Safety and data:** "Demo environment: synthetic records. Not for clinical use." Keep the v1 safety statements.

Update the spec:
- §3.1: replace "IDs are `uuid`" with "IDs are `text` (≤ 64), preserving v1 prefixed IDs".
- §6.1: replace the requirements list with "Implemented in `compose.yaml`: Postgres 18.3, database `main`, dev on 5442 (volume), tests on 5444 (tmpfs)".
- §12: replace "each test runs in a transaction that is rolled back" with "tables are truncated before each test (TRUNCATE is allowed past the immutability triggers)".

- [ ] **Step 5: Final verification and progress notes**

Run: `bun run typecheck && bun run lint && bun run test && bun run test:db && bun run check:bundle && bun run perf`
Expected: everything passes.

Append a "Progress" section to this plan with the date, the commit range and the measured numbers from Steps 1–3.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: performance verification, bundle guard, docs for postgres and matching"
```

---

## Spec coverage check

| Spec item | Task |
|---|---|
| §2 naming, routes, redirects | 1, 10 |
| §3 data model, indexes, immutability, soft delete, concurrency, snapshots | 2, 3, 4 |
| §4 code organisation | 2–7 (file map) |
| §5 background matching: triggers, lifecycle, worker, correctness, live UI | 5, 10 |
| §6 Podman, env, pool, scripts | 2, 5, 14 |
| §7.1 navigation | 1 |
| §7.2 loading, empty, error | 8 |
| §7.3 lists, toolbar, URL filters, keyset | 3, 9 |
| §7.4 header actions | 9 |
| §7.5 detail pages | 11 |
| §7.6 forms | 12 |
| §7.7 result view | 13 |
| §7.8 accordions | 13 |
| §8 server functions, errors | 3, 6 |
| §9 Query, Router, Start practices | 6, 7, 9 |
| §10 performance budgets | 8, 12, 13, 15 |
| §11 realistic data, seeding, legacy import | 7, 14 |
| §12 testing | every task, 15 |
| §14 acceptance criteria 1–11 | 1, 8, 9, 11, 5+10, 1, 12, 13, 13, 2–7, 6+15 |
