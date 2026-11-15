# HLA-Trans

A browser-only demonstration of heart donor–recipient compatibility review. It captures patient and donor records, checks six rule groups with explainable PASS / REVIEW / FAIL findings, supports versioned criteria, and saves evaluations and clinician decisions with snapshots and an audit trail.

**Demo environment: synthetic records only. Not for clinical use. This is not a validated medical device or clinical decision system.** The app advises; a qualified clinician makes the final decision. Missing or unknown clinically relevant inputs require review. Thresholds include center-practice assumptions and need clinical sign-off. Screening order is **not OPTN allocation** and does not implement national match runs.

## Run locally

Use a current Bun release compatible with the version 2 lockfile (verified with Bun 1.4.4). The older global Bun 1.2.19 cannot read this lockfile. With a compatible Bun installed:

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. Alternatively, use `npx bun@1.4.4` in place of `bun` when upgrading the global runtime is inconvenient.

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run preview
```

`test` runs Vitest once; `test:watch` starts watch mode. `build` creates the production SPA output. Static hosting must serve the application shell for application routes. Route components render in the browser; SSR is disabled.

## Local data

Records are stored in this browser profile and origin under localStorage key `hla-trans.db.v1`; there is no backend, account, or multi-user synchronization. Enter a clinician name in the header before recording actions. The Data screen provides synthetic demo records (24 candidates, 12 donors covering every rule scenario), JSON export/import, and reset. Export a backup before clearing browser storage or replacing records. Exported files contain the records and must also remain synthetic. Clearing browser data removes local records; this app is not a durable clinical record system.

Saved evaluations contain copies of the patient, donor, criteria, pair inputs, and results used at that time. Later edits do not rewrite those snapshots. Final decisions require a clinician, rationale, and acknowledgement of FAIL/REVIEW findings; decline also requires a reason.

The implementation uses React, TanStack Start, TypeScript, Tailwind, Base UI, Zod, and Vitest. The domain engine is independent of React and browser storage.

See the [product specification](docs/specs/2026-11-14-heart-compatibility-spec.md), especially safety rules (§3), screens (§7), non-functional requirements (§8), and unresolved clinical defaults (§9). See also the [implementation plan](docs/plans/2026-11-14-heart-compatibility-plan.md). Local QA evidence is maintained in `.superpowers/sdd/2026-11-14-heart-compatibility-plan/` (ignored workspace artifacts).
