# Task 2: schemas, vocabularies and factories

Completed the audited calendar-date gap on top of the existing Task 2 implementation. No schema fields, UI, or calculation functions were changed.

## Changes

- Added `src/domain/dates.ts` with `parseIsoDate(value: string): Date | null`. It accepts exactly `YYYY-MM-DD`, returns a new UTC-midnight Date for a real Gregorian calendar date, and returns null for malformed, empty, or impossible dates. It uses `setUTCFullYear` plus UTC component checks so years 0000–0099 retain their actual year rather than Date.UTC's 1900 offset. Task 3 can import this pure helper.
- The shared schema `isoDate` primitive now calls the parser while continuing to accept empty optional dates. The existing required patient DOB refinement is unchanged, retaining its required-field path.
- Added ten schema cases covering impossible day/month combinations, leap-year and century rules, valid leap days, early years, and empty optional dates. Existing required patient identity and malformed DOB tests remain in place.

## Red/green evidence

Before production changes, `bun run test schema` failed for all five impossible optional referral dates: `2026-02-31`, `2026-99-99`, `2025-02-29`, `1900-02-29`, and `2026-04-31`. Each failed with `expected true to be false`, confirming the original shape-only validator accepted impossible dates. The corrected test targets the real optional donor `identity.referralDate` field and checks the validation issue path.

After the parser and schema change, `bun run test schema` passed all 21 tests. `bun run test` passed all 153 tests across five files. `bun run typecheck` and `bun run lint` both exited 0. The original empty-patient test still proves DOB is required at `identity.dateOfBirth`; the new optional empty-date case passes.

## Scope and limitations

No changes to `calc.ts`; calculation reuse and invalid reference Date handling belong to Task 3. The helper validates date syntax and calendar reality only, without introducing age or historical/future-date policy. Existing date-time validation remains unchanged.
