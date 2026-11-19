# Concord

<img src="public/concord-wordmark.svg" alt="Concord" height="64">

Formerly HLA-Trans. The name is Latin *con* + *cor*, "hearts together".

A demonstration of heart donor–recipient compatibility review. It captures patient and donor records, checks six rule groups with explainable PASS / REVIEW / FAIL findings, supports versioned criteria, matches every new patient or donor in the background, and saves match results and clinician decisions with snapshots and an audit trail.

**Demo environment: synthetic records. Not for clinical use. This is not a validated medical device or clinical decision system.** The app advises; a qualified clinician makes the final decision. Missing or unknown clinically relevant inputs require review. Thresholds include center-practice assumptions and need clinical sign-off. Screening order is **not OPTN allocation** and does not implement national match runs.

## Requirements

- Bun ≥ 1.4
- Podman with `podman compose`
- A [Neon](https://neon.com) project with Auth enabled (sign-in works only through Neon Auth)
- For deploys: a Cloudflare account and `bunx wrangler login`

## Run locally

```sh
cp .env.example .env   # then fill it in, see below
bun install --frozen-lockfile
bun run db:up          # Postgres 18: dev on :5442, tests on :5444
bun run db:migrate
bun run db:seed        # optional: 24 patients, 12 donors, queues match runs
bun run dev            # web on http://localhost:3000 + the matching worker
```

`.env.example` ships without values. For local development with the Podman databases:

| Variable | Local value / where to get it |
| --- | --- |
| `DATABASE_URL` | `postgres://postgres:password@localhost:5442/main` (or a Neon direct connection string to work against Neon) |
| `TEST_DATABASE_URL` | `postgres://postgres:password@localhost:5444/main` (required by `bun run test:db`) |
| `PERF_DATABASE_URL` | `postgres://postgres:password@localhost:5444/perf` (only for `bun run perf`, which truncates it) |
| `NEON_AUTH_BASE_URL` | Neon Console → Auth → Configuration → Auth URL |
| `NEON_AUTH_COOKIE_SECRET` | any 32+ character secret: `openssl rand -base64 32` |
| `DATABASE_URL_POOLED`, `AWS_*`, `S3_BUCKET` | not used by the app yet; leave empty |

In the Neon Console, add `http://localhost:3000` as a trusted domain for Auth, and turn off email verification unless you have set up SMTP (the app has no verification page). Then open http://localhost:3000 and create an account.

`bun run dev` runs the web app inside the Workers runtime (Cloudflare Vite plugin). Its database is the Hyperdrive `localConnectionString` in `wrangler.jsonc` (the Podman dev DB on :5442), not `DATABASE_URL`. The Bun worker, `db:migrate`, `db:seed` and the scripts use `DATABASE_URL`. If that points at Neon, they change production data.

## Deploy (Cloudflare Workers + Neon)

The web app, the match-run queue consumer and a one-minute cron run as one Worker (`src/server.ts`). The Worker reaches Neon through Hyperdrive. Hyperdrive has no `LISTEN/NOTIFY`, so on Workers new runs are announced on the `match-runs` queue instead.

First time only:

```sh
DATABASE_URL="<neon direct url>" bun run db:migrate
bunx wrangler hyperdrive create hla-db --connection-string="<neon direct url>"
bunx wrangler hyperdrive update <hyperdrive-id> --caching-disabled   # cached reads would show stale run status
bunx wrangler queues create match-runs
bunx wrangler secret put NEON_AUTH_BASE_URL
bunx wrangler secret put NEON_AUTH_COOKIE_SECRET
```

Put the Hyperdrive id in `wrangler.jsonc`. In the Neon Console, add the Worker URL (`https://<name>.<account>.workers.dev` or your custom domain) as a trusted domain for Auth.

Every deploy:

```sh
bun run deploy       # vite build && wrangler deploy
bunx wrangler tail   # live logs
```

Run `bun run cf-typegen` after changing bindings in `wrangler.jsonc`. On the Workers free plan each request gets 10 ms of CPU. If the logs show "Exceeded CPU", move to Workers Paid and set `"limits": { "cpu_ms": 300000 }` in `wrangler.jsonc`.

## Test

```sh
bun run typecheck
bun run lint
bun run test          # unit tests
bun run test:db       # needs the postgres-test container
bun run perf          # load test against PERF_DATABASE_URL (truncates it)
bun run check:bundle  # build, then fail if server code reaches the client
```

`bun scripts/load-test.ts --seed-only --wipe-dev-data` fills the dev database with 2,000 patients and 500 donors. It deletes all dev data first.

## Architecture

The pure domain engine (`src/domain`) is shared by three callers: the browser (live preview in Check a pair), TanStack Start server functions (authoritative writes), and the match-run worker (a Bun process locally, queue and cron handlers on Cloudflare Workers). Postgres holds the records (validated `jsonb` plus indexed summary columns), immutable snapshots, match results, the audit log, and the job queue (`FOR UPDATE SKIP LOCKED`; workers are woken by `LISTEN/NOTIFY` under Bun and by a Cloudflare Queue on Workers). Saving a patient or donor queues a match run in the same transaction. Pages load through TanStack Query, warmed by route loaders and rendered on the server.

```mermaid
flowchart LR
  B[Browser] -->|server functions| W[Web server]
  W --> PG[(Postgres)]
  K[Matching worker] -->|claim run, write results| PG
  W -->|NOTIFY or queue message| K
  B -.->|polls run status| W
```

Audit log, match results, criteria versions, snapshots and decisions are append-only (database triggers). Every page and server function requires a signed-in user (Neon Auth, email and password); changes are attributed to that user's name. The theme is stored per browser in a cookie.

See the [v2 specification](docs/specs/2026-11-14-v2-postgres-matching-ux-spec.md) and the [v1 specification](docs/specs/2026-11-14-heart-compatibility-spec.md) for safety rules (§3).

## Backups

```sh
podman compose exec postgres pg_dump -U postgres main > backup.sql
podman compose exec -T postgres psql -U postgres main < backup.sql
```

The in-app export (Data screen) is a record-level JSON file for review. The in-app import accepts v1 browser exports, and a banner offers a one-click import of records left in this browser's localStorage by the old version.

## Records and decisions

Saved match results keep copies of the patient, donor, criteria, pair inputs and results used at that time. Later edits mark them "Out of date" instead of rewriting them. Final decisions are only possible on checked pairs (with pair inputs) and require a clinician, rationale, and acknowledgement of FAIL/REVIEW findings; decline also requires a reason.
