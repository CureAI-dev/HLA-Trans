# HLA-Trans v2: Postgres, Background Matching, Fast UI (Spec v2)

Status: **Draft for review**
Date: 2026-11-14
Builds on: [Spec v1](2026-11-14-heart-compatibility-spec.md). Everything in v1 still holds (rule engine, safety rules §3, clinical defaults §9). The only exceptions are the changes listed here.

---

## 0. Summary of changes

| # | Problem today | v2 change |
|---|---|---|
| 1 | Clicking a sidebar item reloads the whole page | Every internal link becomes a typed router `Link`. A lint rule blocks raw internal `<a href>`. |
| 2 | No loading feedback | Skeletons for each route, a thin top progress bar, pending buttons, empty and error states |
| 3 | Filters are spread out; header buttons have mismatched sizes | Compact filter toolbar; primary actions use the default button; Delete moves into a "More" menu |
| 4 | The donor detail page shows 12 fields | Full read-only record with Overview, Clinical record and Matches tabs, plus risk flags |
| 5 | Matching is manual and blocks the user | Saving a patient or donor starts a background **match run**. Progress shows live. A new **Matching** page lists active and past runs |
| 6 | "Evaluation / New evaluation" naming is unclear | Renamed to **Matching**, **Match results** and **Check a pair** |
| 7 | Patient and donor forms waste side space; native date input | Three-column form (section nav, form, live side panel); shadcn date picker |
| 8 | The result view has good content but is hard to read | Redesigned: verdict header, rule chips, missing-data table, tabs, shadcn accordion per rule, sticky decision panel |
| 9 | Plain `<details>` accordions | Replaced with the shadcn Accordion everywhere |
| 10 | localStorage only | PostgreSQL 17 (Podman) via Drizzle and node-postgres |
| 11 | No TanStack Query; loaders unused | TanStack Query + Router + Start best practices (§9) |
| — | Sample data says "Fictional" | Realistic synthetic dataset that covers every rule scenario (§11) |
| — | Performance | Hard budgets (§10). Navigation with cached data must feel instant |

Decisions confirmed with the owner:
- Naming: **Matching** / **Match results** / **Check a pair**.
- Auto-match: screen the new record against **all** eligible counterparts, using **blank pair inputs**. Edits do not rerun automatically; a manual rerun is available.
- Existing localStorage data: **one-click import**. The demo dataset is replaced with realistic, scenario-complete data.
- Database access: **Drizzle ORM + node-postgres (`pg`)**.
- Clinician identity: **per browser** (cookie). No login.

Open item: **Podman compose file**. The owner will provide it. §6.1 lists what the app needs from it.

---

## 1. Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React UI<br/>Router + Query cache]
  end
  subgraph Web["Web process (TanStack Start, Node)"]
    SSR[SSR + route loaders]
    SF[Server functions<br/>zod-validated]
    REPO[Repositories<br/>Drizzle]
  end
  subgraph Worker["Worker process"]
    W[Match worker<br/>claims runs, runs engine]
  end
  DB[(PostgreSQL 17<br/>Podman)]
  ENG[[Domain engine<br/>pure TypeScript, shared]]

  UI -- "RPC (GET reads / POST writes)" --> SF
  SSR --> REPO
  SF --> REPO --> DB
  W --> DB
  DB -- "LISTEN/NOTIFY match_runs" --> W
  W -.uses.-> ENG
  SF -.uses.-> ENG
  UI -.live preview.-> ENG
```

Key points:
- **The domain engine does not change.** It stays pure and is shared by the browser (live preview), the server (saving a checked pair) and the worker (match runs).
- **The server always recomputes results.** A result sent from the browser is never stored.
- **Matching runs in a separate worker process.** Engine work is CPU-bound, so running it in the web process would slow every request. With a separate process, the web process stays responsive.
- **Postgres is the job queue.** No Redis. Runs are rows; the worker claims them with `FOR UPDATE SKIP LOCKED` and wakes on `NOTIFY`.

---

## 2. Naming (item 6)

| Old | New | Meaning |
|---|---|---|
| Evaluation (screening) | **Match result** | One patient–donor result: snapshot, engine output, optional decision |
| New evaluation | **Check a pair** | Pick a patient and donor, enter logistics and crossmatch, preview live, save |
| Evaluations (history) | **Match results** | List of all saved results |
| — | **Match run** | One background job that screens one record against all eligible counterparts |
| — | **Matching** | Page with active and past runs |
| Screen candidates (donor tab) | **Matches** tab | Results for this donor from runs and checked pairs |

Every result has a **source**: `screening` (from a run, blank pair inputs) or `checked` (entered by a clinician through Check a pair).

**Decisions can only be recorded on `checked` results.** A screening result shows a **Complete this match** action. It opens Check a pair with the patient and donor already selected. Logistics and crossmatch are never known at screening time, and a decision without them is not safe.

### 2.1 Routes

| Route | Screen | Replaces |
|---|---|---|
| `/` | Dashboard | — |
| `/patients`, `/patients/new`, `/patients/$patientId`, `/patients/$patientId/edit` | Patients | — |
| `/donors`, `/donors/new`, `/donors/$donorId`, `/donors/$donorId/edit` | Donors | — |
| `/matching` | Active and past match runs | new |
| `/matching/$runId` | One run: progress and its results | new |
| `/matches` | Match results list | `/evaluations` |
| `/matches/check` | Check a pair | `/evaluations/new` |
| `/matches/$matchId` | Result view and decision | `/evaluations/$evaluationId` |
| `/criteria`, `/audit`, `/data` | unchanged | — |

Old `/evaluations*` URLs redirect (`throw redirect`) to the new ones, keeping params and search.

Sidebar order: Dashboard · Patients · Donors · **Matching** (live badge shows the active run count) · **Match results** · **Check a pair** · Criteria · Audit log · Data.

---

## 3. Data model (PostgreSQL)

### 3.1 Principles
- **Clinical records are stored as validated `jsonb`.** The zod schemas in `domain/schema.ts` stay the source of truth. Fields used for filtering, sorting or joins are copied into typed, indexed columns. This keeps the engine contract unchanged and avoids splitting about 200 fields into columns.
- **Immutability is enforced in the database.** Triggers reject `UPDATE`/`DELETE` on `audit_log`, `match_results`, `criteria_versions` and `record_snapshots`. Application code is not trusted to enforce it.
- **Snapshots are deduplicated.** One run can produce hundreds of results. Each result references a content-addressed snapshot (SHA-256 of canonical JSON) instead of copying a full patient or donor record per row.
- **Soft delete** for patients and donors (`deleted_at`). Historical results keep valid foreign keys.
- **Optimistic concurrency.** Patients and donors carry `version int`. An update must send `expectedVersion`; a mismatch returns a conflict error (§8.3).
- **All timestamps are `timestamptz`.** IDs are `text` (≤ 64 chars), preserving v1 prefixed IDs; new IDs come from `newId(prefix)`.

### 3.2 Entity diagram

```mermaid
erDiagram
  patients ||--o{ match_results : "patient_id"
  donors ||--o{ match_results : "donor_id"
  match_runs ||--o{ match_results : "run_id (nullable)"
  criteria_versions ||--o{ match_results : "criteria_version_id"
  criteria_versions ||--o{ match_runs : "criteria_version_id"
  record_snapshots ||--o{ match_results : "patient/donor snapshot"
  match_results ||--o| decisions : "match_id (unique)"

  patients {
    text id PK
    int version
    text mrn
    text full_name
    text listing_state
    text urgency_status
    text abo
    jsonb data
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  donors {
    text id PK
    int version
    text donor_code
    text state
    text abo
    text donation_type
    int age_years
    jsonb data
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  record_snapshots {
    text hash PK
    text kind
    jsonb data
  }
  criteria_versions {
    text id PK
    int version UK
    text author
    text change_note
    jsonb criteria
    timestamptz created_at
  }
  match_runs {
    text id PK
    text trigger
    text subject_kind
    text subject_id
    text criteria_version_id FK
    text status
    int total
    int processed
    int pass_count
    int review_count
    int fail_count
    int attempts
    text error
    text created_by
    timestamptz created_at
    timestamptz started_at
    timestamptz heartbeat_at
    timestamptz finished_at
    bool cancel_requested
  }
  match_results {
    text id PK
    text run_id FK
    text source
    text patient_id FK
    text donor_id FK
    text patient_snapshot FK
    text donor_snapshot FK
    text criteria_version_id FK
    text engine_version
    jsonb pair
    jsonb result
    text overall
    int blocker_count
    int missing_count
    text created_by
    timestamptz created_at
  }
  decisions {
    text id PK
    text match_id UK
    text verdict
    text clinician
    text rationale
    jsonb reasons
    bool acknowledged_findings
    timestamptz decided_at
  }
  audit_log {
    bigint seq PK
    text id UK
    timestamptz at
    text actor
    text action
    text subject_id
    text summary
  }
```

`decisions` is a separate table, so `match_results` can stay fully immutable. The unique constraint on `match_id` means a result can have at most one decision, and Postgres enforces it.

### 3.3 Indexes (each one backs a real query)

| Index | Query it serves |
|---|---|
| `patients (listing_state) WHERE deleted_at IS NULL` | Candidate set for a donor run |
| `donors (state) WHERE deleted_at IS NULL` | Candidate set for a patient run |
| `patients (updated_at DESC, id)`, `donors (updated_at DESC, id)` | Keyset-paginated lists |
| `patients USING gin (full_name gin_trgm_ops, mrn gin_trgm_ops)` (`pg_trgm`) | Search box |
| `match_results (created_at DESC, id)` | Match results list |
| `match_results (donor_id, created_at DESC)`, `(patient_id, created_at DESC)` | Matches tabs |
| `match_results (run_id, overall)` | Run detail, grouped by verdict |
| `UNIQUE match_results (run_id, patient_id, donor_id) WHERE run_id IS NOT NULL` | Idempotent run resume (§5.4) |
| `match_runs (status, created_at) WHERE status IN ('queued','running')` | Worker claim and active-run polling |
| `match_runs (created_at DESC, id)` | Run history |
| `audit_log (at DESC, seq)` | Audit list |

### 3.4 Audit actions
Existing actions stay, plus: `match_run.queued`, `match_run.succeeded`, `match_run.failed`, `match_run.cancelled`, `match.checked` (replaces `evaluation.created`), `match.decided` (replaces `evaluation.decided`). Imports map the old names to the new ones. Every write goes through one repository function. It writes the change and the audit row **in the same transaction**.

---

## 4. Code organisation

Feature folders on the client, a strict server-only boundary, and an unchanged domain.

```
src/
  domain/                      # unchanged: schema, engine, rules, calc (pure, no I/O)
  server/                      # server-only. Every file ends in .server.ts
    env.server.ts              # zod-validated env (DATABASE_URL, …); fail fast
    db/
      client.server.ts         # pg Pool singleton (globalThis guard for HMR)
      schema.server.ts         # Drizzle tables
      migrations/              # drizzle-kit SQL, committed
      triggers.sql             # immutability triggers, applied by migration
    repos/                     # one per aggregate; all SQL lives here
      patients.server.ts  donors.server.ts  matches.server.ts
      runs.server.ts      criteria.server.ts audit.server.ts  snapshots.server.ts
    matching/
      enqueue.server.ts        # create run row + NOTIFY (inside caller's tx)
      process-run.server.ts    # chunked engine loop
    middleware/
      clinician.server.ts      # reads clinician cookie → context.actor
      errors.server.ts         # maps DbConflict/NotFound/Validation → typed errors
  worker/
    main.ts                    # worker entry: LISTEN, claim, process, reap
  features/                    # client-facing; each feature owns its API + UI
    patients/
      patients.functions.ts    # createServerFn wrappers (thin; call repos)
      patients.queries.ts      # queryOptions + key factory
      patients.mutations.ts    # useMutation hooks (cache updates)
      components/              # form, table, detail, summary
    donors/   matches/   matching/   criteria/   audit/   data/
  components/
    ui/                        # shadcn (unchanged)
    app/                       # shell, sidebar, page header, top progress, status
    form/                      # field kit (+ new DatePickerField)
  routes/                      # thin: params/search validation, loader, layout
  lib/
    query-client.ts            # QueryClient factory + defaults + global error toasts
    clinician.ts               # cookie read/write (browser)
    legacy-import.ts           # reads old localStorage key once (§11.3)
```

Rules:
- **Route files stay thin.** A route file only validates search and params, runs the loader (`ensureQueryData` / `prefetchQuery`), sets `head` and pending/error components, and renders a feature component.
- **Only `*.server.ts` files import `pg` or Drizzle.** Start's import protection keeps them out of the client bundle; the implementation must confirm this with a build check (§12).
- **Server functions are thin.** Each one validates its input, then calls one repository function, then returns a plain serialisable object.
- **The domain imports nothing from features, server or React.**
- The old `lib/storage/*` is deleted once the legacy import (§11.3) is in place. Only the read-only legacy reader stays.

---

## 5. Background matching (item 5)

### 5.1 Trigger rules

| Event | Run created | Candidate set (taken when the worker claims the run) |
|---|---|---|
| Donor created | `subject_kind=donor` | Patients with `listing_state='active'`, not deleted |
| Patient created | `subject_kind=patient` | Donors with `state='available'`, not deleted |
| "Rerun matching" button (patient or donor detail) | Same as above, `trigger='manual'` | Same |
| Edit, or criteria publish | **No automatic run.** Older results show an **Out of date** badge | — |

A result is **out of date** when its snapshot hash differs from the hash of the current record, or when its criteria version is older than the latest published one. Both are computed in SQL; no extra writes are needed.

The run is inserted **in the same transaction** as the patient or donor (transactional outbox), so a saved record always has its run. `NOTIFY match_runs` fires on commit.

### 5.2 Run lifecycle

```mermaid
stateDiagram-v2
  [*] --> queued: record saved (same tx)
  queued --> running: worker claims (SKIP LOCKED)
  queued --> cancelled: user cancels
  running --> running: chunk committed (processed += n, heartbeat)
  running --> succeeded: all pairs done
  running --> cancelled: cancel_requested seen between chunks
  running --> queued: heartbeat stale > 60 s and attempts < 3 (reaper)
  running --> failed: error, or attempts = 3
  queued --> cancelled: subject deleted before claim
  succeeded --> [*]
  failed --> [*]
  cancelled --> [*]
```

### 5.3 Worker algorithm
1. On start, `LISTEN match_runs`. Wake on each notification, and also every 5 s as a fallback (a notification can be lost if the worker restarts).
2. **Claim** in one statement: `UPDATE match_runs SET status='running', started_at=coalesce(started_at, now()), heartbeat_at=now(), attempts=attempts+1 WHERE id = (SELECT id FROM match_runs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. This is safe with any number of workers.
3. Load the subject, the candidate set and the run's criteria version. Set `total`.
4. Process in **chunks of 50 pairs**. Each chunk is one transaction: upsert snapshots (`ON CONFLICT DO NOTHING`), insert results (`ON CONFLICT DO NOTHING` on the run/pair unique index), increment `processed` and the verdict counters, and update `heartbeat_at`.
5. Between chunks, re-read `cancel_requested`. If it is set, mark the run `cancelled` and stop.
6. Finish: set `succeeded`, write `finished_at`, add an audit row.
7. **Reaper** (every 30 s): runs whose `heartbeat_at` is older than 60 s go back to `queued` if `attempts < 3`; otherwise to `failed`, with the error recorded.
8. Shut down cleanly on `SIGTERM`: finish the current chunk, then exit. The next claim resumes from the unique index.

**Cost:** one engine call is O(r), where r is the number of rules and antigens (small, constant). A run is O(n) in the candidate count. Rows inserted per run are O(n), but snapshot rows are O(1) per distinct record. Target: ≥ 500 pairs/s on a laptop (§10).

### 5.4 Correctness
- **Idempotent:** if a crashed or reclaimed run repeats a chunk, the unique index makes it a no-op. The counters are recomputed from `match_results` when the run finishes, so a repeated chunk cannot double-count.
- **No lost runs:** the outbox is written in the same transaction, and the worker also polls every 5 s.
- **No double processing:** `SKIP LOCKED` plus the claim statement.
- **Consistent snapshot per run:** the criteria version is fixed when the run is created. Each patient or donor record is snapshotted when its chunk is processed, and the result records exactly what it used.

### 5.5 Live status in the UI

```mermaid
sequenceDiagram
  actor C as Clinician
  participant UI as Browser
  participant SF as Server fn
  participant DB as Postgres
  participant W as Worker
  C->>UI: Save donor
  UI->>SF: createDonor (POST)
  SF->>DB: BEGIN; insert donor; insert run(queued); audit; NOTIFY; COMMIT
  SF-->>UI: donor + runId
  UI->>UI: toast "Matching started" + set runs.active cache
  UI-->>C: Navigates to donor page (not blocked)
  W->>DB: claim run
  loop every chunk
    W->>DB: insert results, processed += 50
    UI->>SF: runs.active (poll 1 s while any active)
    SF-->>UI: progress
  end
  W->>DB: status = succeeded
  UI->>UI: toast "Matching finished: 3 pass · 7 review · 14 fail" (link)
  UI->>UI: invalidate matches + donor matches
```

- **Header indicator:** when runs are active, the header shows a spinner and "2 matching". Clicking it opens a popover listing each run with a progress bar, ETA, and Open / Cancel actions.
- **Polling:** a single small query, `matching.active`. `refetchInterval` is 1 s while any run is queued or running, and 15 s when idle (this picks up runs started in other tabs). It never polls while the tab is hidden. The response contains only counters, not results.
- **Completion:** the client compares the previous and next active lists. When a run leaves the list, it shows a toast and invalidates the affected keys (`['matches']`, the subject's `matches` list and `['dashboard']`).
- **Matching page (`/matching`):**
  - Top: **Active** runs, as cards with subject, trigger, progress bar (`processed / total`), live pass/review/fail counters, elapsed time and Cancel.
  - Below: **History**, a keyset-paginated table with status, subject, trigger, criteria version, counts, duration, started by and finished at. Filters (status, subject type, date range) live in the URL.
- **Run detail (`/matching/$runId`):** header with status and progress, then results grouped by verdict (Pass / Review / Fail tabs) with screening order. Screening order uses the same sort as v1 §6.7, done in SQL with `ORDER BY` on extracted columns.

---

## 6. Postgres with Podman (item 10)

### 6.1 Compose file
Implemented in `compose.yaml` (project `hla-trans`): Postgres 18.3, database `main`, dev on host port 5442 (named volume), tests on 5444 (tmpfs, fsync off). A third database `perf` on the test server is used by the load test.

### 6.2 App configuration
- `.env` (git-ignored) holds `DATABASE_URL=postgres://postgres:password@localhost:5442/main`. A committed `.env.example` documents it. `env.server.ts` validates the URL with zod at boot and exits with a clear message if it is missing.
- Pool: `pg.Pool` with `max: 10` for web and `max: 4` for the worker, `idleTimeoutMillis: 30_000`, and `statement_timeout: 5s` for web requests. One pool per process, stored on `globalThis` so Vite HMR does not leak connections.
- Extensions: `pg_trgm` (search), created in a custom migration. IDs are generated in application code.

### 6.3 Scripts

| Script | Does |
|---|---|
| `db:up` | `podman compose up -d` |
| `db:generate` | `drizzle-kit generate` (SQL migration from schema diff) |
| `db:migrate` | Apply migrations (programmatic migrator, also run on worker and web boot in dev) |
| `db:seed` | Load the realistic demo dataset (§11) |
| `db:studio` | `drizzle-kit studio` |
| `worker` / `dev:worker` | Run the worker (`--watch` in dev) |
| `dev` | Web + worker together |

---

## 7. UI changes

### 7.1 Navigation (item 1)
- All internal `<a href="/…">` become `<Link to="…" params search>`. The sidebar uses `Link` with `activeProps` and `activeOptions` (`exact` for `/`). The special "Evaluations vs New evaluation" active-state code is removed because the routes no longer overlap.
- Buttons that navigate use `<Button render={<Link … />}>` (Base UI `render` prop), so they get router behaviour and preloading.
- Hash links inside a page (rule anchors, form sections) use buttons that scroll programmatically and open the target accordion item, so they no longer depend on `#` routing.
- An ESLint rule (`no-restricted-syntax` on JSX `a` elements whose `href` starts with `/`) fails CI on regressions.

### 7.2 Loading, empty and error states (item 2)
- **Top progress bar:** a 2 px bar shown while `router.state.status === 'pending'` or `useIsFetching() > 0`, with a 150 ms delay so fast responses show nothing.
- **Route skeletons:** each route defines a `pendingComponent` that matches its final layout (table rows, detail cards, form sections). Router settings: `defaultPendingMs: 150` and `defaultPendingMinMs: 300`. A skeleton never flashes for less than 300 ms.
- **Mutations:** the submit button shows a spinner, is disabled and announces "Saving…". Only that form is disabled, not the page.
- **Background refetch** never shows a skeleton; stale data stays visible. Lists use `placeholderData: keepPreviousData` so paging or filtering never empties the table.
- **Empty states** use the shadcn `Empty` component with one clear action ("Add donor", "Load demo dataset").
- **Errors:** each route has an `errorComponent` with the message and a **Retry** button (`router.invalidate()` plus the query reset boundary). Records that do not exist call `throw notFound()` in the loader and render a proper not-found view.

### 7.3 Lists: patients, donors, match results, runs (item 3)
- **Filter toolbar:** one row, left-aligned. Search input (`max-w-sm`, runs on Enter or its search button, never while typing), then compact `Select`s (auto width) for state, ABO, urgency or verdict, then a **Reset** ghost button that only appears when a filter is active. It wraps on narrow screens. No more four-column grid.
- **Filters, sort and page are URL search params**, validated with zod (`fallback` for bad values). This makes them shareable, preserved on back navigation, and part of the query key.
- **Server-side filtering and keyset pagination**, 50 rows per page. List queries select summary columns only, never full `jsonb` records.
- **Primary page action:** `Add donor` / `Add patient` use the **default** button variant with a `Plus` icon, at the right of the page header.

### 7.4 Detail page header actions (item 3)
- Header layout: title, subtitle and status badges on the left. On the right, the actions are aligned on one baseline and are the same height (`size="default"`):
  - **Edit donor**: default variant, `Pencil` icon.
  - **Check a pair**: outline variant.
  - **More** (`MoreHorizontal` icon button) → dropdown with **Rerun matching** and **Delete donor** (destructive item). Delete opens an `AlertDialog`. Confirming deletion shows a pending state and navigates only after success.
- The same pattern applies to patients.

### 7.5 Donor detail page (item 4); the patient page mirrors it

```mermaid
flowchart TB
  H["Header: Donor code · state badge · ABO · age/sex · donation type<br/>Actions: Edit · Check a pair · More"]
  H --> T{Tabs}
  T --> O[Overview]
  T --> R[Clinical record]
  T --> M[Matches]
  O --> O1[Key facts grid<br/>hospital, OPO, referral date, cause/mechanism of death]
  O --> O2[Derived: BMI · BSA · PHM]
  O --> O3[Risk flags<br/>cardiac arrest + CPR min, CO poisoning, cocaine, PHS criteria,<br/>LVEF below threshold, high-dose inotropes, DCD]
  O --> O4[Data completeness<br/>missing clinically relevant fields → link to edit section]
  O --> O5[Latest match run summary<br/>pass/review/fail counts + link]
  R --> R1[Every schema section as a read-only card<br/>Identity · Body · Blood · Donation · Death · History ·<br/>Hemodynamics · Echo · Coronary · ECG · Labs · Infection · HLA · Notes]
  M --> M1[Results table: patient, verdict, blockers, missing,<br/>source, out-of-date badge, created<br/>filters in URL · Complete this match]
```

- **Clinical record** lists every field in the schema in two-column definition lists, using the same labels as the form. Empty values show a muted "Not recorded". Labs show initial / peak / latest with units. HLA shows the typing grid read-only. Each card has an "Edit section" link that opens the edit route at that section.
- **Risk flags** are computed by a pure function in `domain/` from the same thresholds as the engine and the active criteria, so the flags and the engine always agree. Unit tests cover them.
- **The tab is a search param** (`?tab=overview|record|matches`), so it survives reload and back navigation. Tabs use the shadcn `Tabs` component instead of the hand-rolled ARIA buttons.

### 7.6 Patient and donor forms (item 7)

```mermaid
flowchart LR
  subgraph xl["≥ 1280 px"]
    A["Left rail (sticky, 220 px)<br/>Section nav with scroll-spy<br/>✓ complete · ● n missing · ⚠ n errors"]
    B["Form column (max 768 px)<br/>Sections as Cards<br/>Fields in 2 columns"]
    C["Right rail (sticky, 300 px)<br/>Live derived values (BMI, BSA, PHM, age)<br/>Completeness meter<br/>Validation summary → focus field<br/>Save / Cancel"]
  end
```

- Between 1024 and 1279 px the right rail moves under the nav as a collapsible card. Below 1024 px a **sticky bottom action bar** holds Save/Cancel and the error count, and the section nav becomes a horizontal scroll strip.
- **Date fields** use the shadcn date picker (`Popover` + `Calendar`), with a typed input next to it for keyboard entry. The value stays an ISO `yyyy-mm-dd` string, matching the schema. Birth dates use `captionLayout="dropdown"` with year bounds. Future dates are disabled where the schema forbids them. The existing `react-day-picker` major version must be confirmed compatible with the generated `calendar.tsx`; if not, the version is pinned to the one shadcn supports.
- **Unsaved-changes guard:** `useBlocker({ withResolver: true })` with a shadcn `AlertDialog` instead of `window.confirm`. `enableBeforeUnload` is on while the form is dirty.
- **Typing performance:** the form keeps one value object. Each section is `React.memo` and receives only its own slice and a stable `setField(path, value)` callback, so a keystroke re-renders one section, not 200 fields. Derived values are memoised. Today's form hook runs `JSON.stringify` on the whole record twice per render to compute "dirty". That is replaced by a dirty flag set in `setField` and cleared on save/reset, which is O(1) per keystroke instead of O(record size).
- **On save:** a pending button. On success, the detail cache is set from the response, lists are invalidated, and the app navigates to the detail page. For creates, a toast says "Saved. Matching started" with a link to the run.

### 7.7 Match result view (item 8)

```mermaid
flowchart TB
  S["Sticky verdict bar<br/>Overall badge (large) · Patient ↔ Donor · source · criteria vN · engine vX · Out-of-date badge"]
  S --> CH["Rule chips (6): Blood type ✓ · Size ⚠ · HLA ✗ …<br/>click = scroll + open accordion item"]
  CH --> MAIN
  subgraph MAIN[Main column]
    BL["Blockers: destructive Alert, one line each"]
    MS["Missing data: table (Field · Rule · Fix → link to exact form section)"]
    TB{Tabs}
    TB --> F["Findings: shadcn Accordion (multiple)<br/>FAIL/REVIEW rules open by default"]
    TB --> SBS["Patient vs donor: aligned comparison table"]
    TB --> PI["Pair inputs & ischemia breakdown"]
  end
  subgraph RAIL[Right rail, sticky]
    DEC["Decision panel (checked results)<br/>or 'Complete this match' (screening results)"]
  end
```

- **Accordion trigger:** rule name, status badge, and counts ("1 fail · 2 review · 3 info").
- **Finding row:** a status icon in a fixed 24 px column, the title in medium weight, and the detail in normal text (max 72 characters per line). Evidence and Source sit in a muted two-column grid below, with labels at a fixed width so values line up. No repeated large badges.
- **INFO findings** sit behind a "Show n info findings" toggle inside each rule.
- **Missing-data "Fix" links** go to the exact edit route and section (`/donors/$id/edit#echo`, rendered as a `Link` with `hash`), not a generic edit page.
- **Typography:** body 14 px with line-height 1.6, section headings 16 px semibold. The page aims for one reading column of about 72 characters, with the decision panel on the right at xl.

### 7.8 Accordions (item 9)
Both `<details>` uses are replaced by the shadcn `Accordion`: rule cards and criteria history. The criteria history uses `type="single" collapsible`. The diff is rendered lazily, only when an item opens.

---

## 8. Server functions and API contract

### 8.1 Pattern
- Reads use `createServerFn({ method: 'GET' })`. Writes use `method: 'POST'`.
- Every function calls `.validator(zodSchema)`. This is the method name in the installed `@tanstack/react-start` 1.169; versions are pinned so a rename cannot slip in. POST functions are covered by Start's built-in CSRF middleware. Writes use `.middleware([clinicianMiddleware])`, which reads the clinician cookie. A write without a clinician name is rejected with a typed error, and the UI prompts for a name.
- Return plain JSON-serialisable objects. Dates are ISO strings, as in the existing schemas.

### 8.2 Functions

| Feature | Reads | Writes |
|---|---|---|
| patients | `list({q, state, abo, urgency, cursor})`, `get(id)` | `create(patient)` → `{patient, runId}`, `update(patient, expectedVersion)`, `remove(id)`, `rerun(id)` → `{runId}` |
| donors | same shape | same shape |
| matches | `list(filters, cursor)`, `get(id)` (joins snapshots, criteria, decision), `listForPatient`, `listForDonor` | `check({patientId, donorId, pair})` (server recomputes), `decide(matchId, decision)` |
| matching | `active()`, `history(filters, cursor)`, `get(runId)`, `results(runId, verdict, cursor)` | `cancel(runId)` |
| criteria | `latest()`, `versions()` | `publish(criteria, note)` |
| audit | `list(filters, cursor)` | — |
| data | `export()` (streamed JSON) | `import(file)` (validate all, then one transaction), `seed()`, `reset({confirm:'RESET'})`, `importLegacy(json)` |
| dashboard | `summary()` (counts, pending decisions, recent results, active runs) | — |

### 8.3 Errors
Typed error codes, mapped by middleware: `VALIDATION`, `NOT_FOUND`, `CONFLICT` (version mismatch: "This record changed since you opened it. Reload to see the latest version."), `CLINICIAN_REQUIRED` and `INTERNAL` (details logged on the server only). A global `MutationCache.onError` shows a toast. Forms show field errors from `VALIDATION` issues next to the matching fields.

---

## 9. TanStack best practices (item 11)

### 9.1 Query
- **`queryOptions` factories per feature** with a hierarchical key factory, for example `patientKeys = { all: ['patients'], lists: () => [...all, 'list'], list: (f) => [...lists(), f], detail: (id) => [...all, 'detail', id] }`. Every `useQuery`, `useSuspenseQuery`, loader and invalidation goes through these factories.
- **Defaults:** `staleTime: 30_000`, `gcTime: 300_000`, `retry: 1` for queries and `0` for mutations, `refetchOnWindowFocus: true`.
- **Server data never goes into `useState`.** Derived data uses `select`.
- **Mutations update the cache precisely:** `setQueryData` on the detail key from the response, then `invalidateQueries` on the matching list keys only. Decisions are **not** optimistic (clinical record). Simple toggles may be optimistic.
- `keepPreviousData` for paginated and filtered lists.
- **Polling** uses a function `refetchInterval` (§5.5) and `refetchIntervalInBackground: false`.

### 9.2 Router
- **`createRootRouteWithContext<{ queryClient: QueryClient }>()`.** The QueryClient is created per request inside `getRouter()` and wired with `setupRouterSsrQueryIntegration`.
- **Loaders:** `await queryClient.ensureQueryData(...)` for data needed for first paint. `queryClient.prefetchQuery(...)` without `await` for secondary data (for example the Matches tab). Components read with `useSuspenseQuery`.
- **Caching:** `defaultPreload: 'intent'`, with `defaultPreloadStaleTime: 0` so Query, not the router, decides freshness. Hovering a link warms the cache, so the click renders instantly.
- **`loaderDeps`** include only the search params the loader uses.
- **Search params** use `validateSearch` with zod and `.catch()` defaults, and are written with `navigate({ search: (prev) => ({...prev, …}) })`.
- **Typed `Link`/`navigate`** everywhere; no string-built URLs. Missing records `throw notFound()` and old URLs `throw redirect()`.
- **Per-route** `head()` titles, `pendingComponent` and `errorComponent`.
- **`autoCodeSplitting`** is on, so each route's component is a separate chunk.

### 9.3 Start
- **SSR is enabled** (the SPA-only setting is removed), because data now comes from the server. The first load arrives with data already rendered and no loading spinner. Theme and clinician name move to **cookies**, so SSR renders them correctly without a flash. `ClientOnly` stays only where a component truly needs browser APIs.
- **Server-only code** lives in `*.server.ts`. Start's import protection blocks the default pattern `**/*.server.*` from the client graph (confirmed in the installed plugin schema), and the CI bundle grep in §12 double-checks it. Env access is validated once.
- **Versions to add** (latest at time of writing, pinned exactly): `@tanstack/react-query` 5.107.1, `@tanstack/react-router-ssr-query` 1.167.3, `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `pg` 8.23.1. The `"latest"` ranges on the existing TanStack packages are also replaced with exact versions, so Router, Start and the SSR-query integration stay in lockstep.
- **Middleware** handles cross-cutting concerns: clinician actor, error mapping and request logging.
- **Server functions are the only data API.** No separate REST layer is needed.

---

## 10. Performance budgets (non-negotiable)

| Metric | Budget | How |
|---|---|---|
| Navigation with warm cache (hovered link) | ≤ 50 ms to final UI, no skeleton | Intent preload + Query cache |
| Navigation, cold, local DB | p95 ≤ 300 ms | Indexed summary queries, SSR stream |
| List server function, 10k rows | p95 ≤ 40 ms | Keyset pagination, summary columns, indexes (§3.3) |
| Detail server function | p95 ≤ 30 ms | PK lookup + snapshot join |
| Keystroke in patient form | ≤ 16 ms render (1 frame) | Memoised sections, slice props |
| Live preview on Check a pair | ≤ 16 ms per change | Engine is pure; `useDeferredValue` on inputs |
| Matching throughput | ≥ 500 pairs/s | Separate worker, chunked inserts |
| Web request latency during a large run | No regression > 10 % | CPU work is out of the web process |
| Initial JS (shell, gzip) | ≤ 250 KB | Route code splitting; recharts/shiki only on routes that use them |
| CLS | 0 on route change | Skeletons match the final layout |

Verification: a seeded load test with 2,000 patients and 500 donors (generated, not the demo set), timed with server timing logs. Browser checks use the Performance panel. These results are recorded in the plan's QA notes.

---

## 11. Data

### 11.1 Realistic demo dataset
The word "Fictional" is removed from names, IDs, hospitals and notes. Records use realistic, diverse full names, MRN-style IDs (`MRN-0042817`), UNOS-style donor codes (`AHFK214`), plausible US transplant centres and OPOs, and dates relative to "today", so durations and ages stay valid over time. The data is still **synthetic**. The app-wide notice changes to "Demo environment: synthetic records. Not for clinical use." (Safety rule v1 §3 stays.)

Size: 24 patients and 12 donors. Every scenario below is covered by at least one pair, and a seed test asserts each one is reached:

| Rule group | Scenarios |
|---|---|
| ABO | identical; compatible non-identical; incompatible; pediatric ABO-incompatible opted in and opted out; unknown ABO; A2 subtype |
| Size | PHM pass; PHM review band; PHM fail; female→male; elevated PVR adjustment; pediatric weight ratio; missing height |
| Immunology | no antibodies; unacceptable antigen hit (DSA); high cPRA with no DSA; positive flow crossmatch; positive CDC; missing donor HLA |
| Infection | clean; HCV NAT+ to HCV-negative candidate (accepts / does not accept); HBV core Ab+; CMV D+/R−; PHS risk criteria; missing serology |
| Donor heart | normal; donor age > 55; LVEF below threshold with repeat echo improving; high-dose inotropes; known CAD; cocaine; CO poisoning; prolonged CPR; DCD |
| Logistics | short ischemia; ischemia over threshold; OCS perfusion excluded from cold time; redo sternotomy addition; missing distance |
| Listing | active / inactive / transplanted / removed; each urgency status; days at status from listing date |

### 11.2 Seeding
`db:seed` and the Data page's **Load demo dataset** are idempotent: records upsert on fixed IDs. Seeding queues a match run for each donor, so the Matching page shows realistic activity straight away.

### 11.3 One-click legacy import
On first app load, if the old `hla-trans.db.v1` localStorage key exists and has not been imported yet (tracked in localStorage), a dismissible banner offers **Import browser data**. The browser sends the JSON to `data.importLegacy`. The server validates it with the existing `validatedDbSchema`, maps the old audit action names to the new ones, inserts everything in **one transaction** (keeping IDs and timestamps; existing IDs are skipped and reported), and returns counts. The local key is kept until the owner deletes it from the Data page.

---

## 12. Testing

- **Domain:** the existing Vitest suite runs unchanged and must stay green.
- **Repositories and worker:** integration tests against the test database (`main` on :5444). Migrations run once per test run, and tables are truncated before each test (TRUNCATE is allowed past the immutability triggers). Covered:
  - Immutability triggers reject UPDATE/DELETE.
  - Version conflict.
  - A soft-deleted record is excluded from candidate sets.
  - Concurrent claims by two workers never process the same run.
  - Crash mid-run (stale heartbeat) leads to reclaim and correct final counts.
  - Cancel between chunks.
  - Outbox: rolling back the record insert means no run is created.
  - Legacy import: round-trip and duplicate IDs.
- **Seed coverage test:** every scenario in §11.1 is reached.
- **Build checks:**
  - The client bundle contains no `pg` or `drizzle-orm`. Grep the client output in CI.
  - Lint passes, including the raw-anchor rule.
- **Manual QA in the browser:**
  - Sidebar navigation keeps the JS heap and network panel free of document reloads.
  - Skeletons appear on throttled network.
  - Creating a donor shows live progress while you navigate elsewhere.
  - Result view readability at 1280, 1440 and 1920 px.

---

## 13. Delivery phases

```mermaid
gantt
  dateFormat X
  axisFormat %s
  section Foundation
  P0 Links + lint rule + naming/routes + redirects         :p0, 0, 1
  P1 Postgres, Drizzle, migrations, triggers, repos        :p1, after p0, 3
  P2 Server fns + Query + loaders + SSR + cookies          :p2, after p1, 3
  section Matching
  P3 Runs table, outbox, worker, reaper, Matching pages    :p3, after p2, 3
  section UI
  P4 Loading/empty/error states, list toolbar, headers     :p4, after p2, 2
  P5 Detail pages, forms (3-col, date picker), accordions  :p5, after p4, 3
  P6 Result view redesign                                  :p6, after p5, 2
  section Data & quality
  P7 Realistic seed + legacy import                         :p7, after p3, 2
  P8 Perf verification against §10, QA                      :p8, after p6, 2
```

P0 fixes the reload problem on its own and can ship first. Each phase ends with typecheck, lint, tests and build all passing.

---

## 14. Acceptance criteria (mapped to the owner's list)

1. No sidebar or in-app navigation causes a document request (verified in the Network panel). Lint fails on raw internal anchors.
2. Every route has a skeleton, an error view with retry and an empty state. Every mutation button shows a pending state.
3. The list filter toolbar is one compact row. Add/Edit use the default variant at equal height, and Delete sits in the More menu with confirmation.
4. The donor and patient detail pages show every recorded field, plus risk flags, completeness and matches.
5. Saving a patient or donor returns immediately and starts a run. Progress is visible from any page. `/matching` lists active and past runs. The app stays fully usable during a run.
6. No "evaluation" wording remains in the UI. Old URLs redirect.
7. Forms use the three-column layout at xl, the shadcn date picker, a dialog-based unsaved guard, and meet the typing budget.
8. The result view follows §7.7. Every finding's evidence and source are readable at 1280 px without horizontal scanning.
9. No `<details>` elements remain. The shadcn Accordion is used.
10. All data lives in Postgres running on Podman. Migrations are committed. Immutability is enforced by triggers.
11. Query, Router and Start follow §9. The budgets in §10 are met and recorded.

---

## 15. Out of scope for v2
- Login, roles and permissions (the clinician name is still self-declared).
- Server-sent events or WebSockets for progress (polling meets the need at this scale; revisit if run counts grow).
- Automatic reruns on edit or criteria publish (results show an Out of date badge instead).
- OPTN allocation and cPRA computation (unchanged from v1).
