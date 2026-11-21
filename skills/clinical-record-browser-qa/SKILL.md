---
name: clinical-record-browser-qa
description: Run supervised, three-agent browser QA of Concord patient and donor forms and matching. Use when asked for deterministic synthetic cases, exact match-result comparison, or reproducible clinical safety bug reports.
---

# Clinical record browser QA

Use this skill only when the user asks to run the QA flow. Creating or editing the skill does not start a browser or write test records. A successful run establishes agreement with a specified oracle for the tested build and cases; it does not certify clinical safety.

## Start three agents

The invoking agent is the **supervisor**. It starts exactly two independent subagents with the host's native delegation tool:

| Agent | Owns | Must not do |
| --- | --- | --- |
| Supervisor | Case plan, independent expected results, release gate, exact comparison, bug files, final report | Fill forms or accept the app engine as its oracle |
| JSON generator | Produce schema-valid, synthetic patient, donor, and pair-input JSON continuously | Read observed results, write expected results, browse the app |
| Browser operator | Read released inputs, enter them in the UI, capture saved records and match results | Edit fixtures, read the supervisor's oracle, decide whether a result is correct |

Give both workers their role, file paths, stop conditions, and the target origin. Keep both active while there are cases to process. If the coding agent cannot launch and supervise two subagents, report `BLOCKED: three-agent execution unavailable`. Do not simulate three agents in one conversation.

## Establish the test contract

Read `AGENTS.md`, `src/domain/schema.ts`, `src/domain/options.ts`, the patient and donor form sections, and `src/domain/match-types.ts`. The current code defines the input and output shapes. Use the v1 spec sections 3 and 6 for intended safety behavior and the v2 spec for Match runs and checked pairs. For claims about current transplant policy, verify the effective text and date in the [official OPTN policies](https://optn.transplant.hrsa.gov/media/eavh5bf3/optn_policies.pdf). A repository rule and current clinical policy are separate claims.

Before any production save, the supervisor records the exact target origin, deployed revision or engine version, active criteria version and complete criteria values, intended result source, and a bounded execution window. The browser operator may gather these read-only facts and report them to the supervisor. If the criteria values or build cannot be identified, exact-result cases are blocked. Do not guess defaults from local source when the deployed app may differ.

Use one patient and one donor with unique `QA-` visible identifiers for each isolated pair. A patient or donor save queues a background Match run. For automatic screening, compare only the result identified by the case's patient ID, donor ID, and run ID; other records in the database make run totals variable. Screening uses blank pair inputs. For a checked pair, explicitly enter and verify every pair input and compare the saved `checked` result. Never record a clinical decision.

## Continuous, sealed handoff

Create runtime artifacts only when the skill is invoked, under `qa/medical-browser/<run-id>/`. The generator publishes each case as an immutable `cases/<case-id>/input.json` by writing a temporary sibling and renaming it. The supervisor publishes a small manifest with monotonically increasing revisions and states:

`proposed → validated → oracle-sealed → released → entered → observed → compared`

The browser operator repeatedly reads the manifest and processes only `released` cases. It records the input file's SHA-256 before and after entry. A changed hash invalidates the case. The supervisor alone moves a case to `released` after its complete expected result is sealed. Use new case IDs for revisions; never edit an input or oracle in place. The operator reads `input.json` but never `oracle.json`, so the observation remains blind to the expected answer.

Each `input.json` contains a case ID, purpose, unique patient and donor records, any planned versioned edits and their expected persisted values, source (`screening` or `checked`), complete pair inputs, target origin, planned criteria version, time window, and the rule boundaries exercised. Each edit that creates a new result is a separate sealed comparison step. The generator may use factories to make valid objects, but must not call `evaluate`, copy an app result, or invent an expected verdict.

The generator validates both records with `patientSchema` and `donorSchema` and the pair with `pairInputsSchema`. It checks every editable form path against the form and record section definitions and maps it to the actual UI control. Distinguish `null`, empty text, numeric zero, `false`, and `unknown`. Check chronology, units, HLA formatting, array rows, unique IDs, and that no real patient or clinician data entered the fixture. A schema pass alone does not establish a clinically meaningful case.

## Field coverage and release gate

Before releasing cases, the supervisor builds `field-matrix.json` from the deployed patient, donor, and checked-pair forms, then reconciles it with the schemas, form section definitions, and record detail/edit views. Include every editable control, including controls shown only after a condition or an add-row action. For each control record its JSON path, label, type, options, units, required/optional rule, valid range or format, default, validation rule, conditional visibility rule, and whether it affects matching, only the stored record, or display. A path with no UI control or a UI control with no mapped path is a finding.

For every field, plan and collect evidence for valid entry, pre-save readback, saved readback after reload, and an edit-save-reload round trip with a second valid value where the field is editable. Exercise each applicable boundary and distinct state: blank, missing, `null`, `unknown`, `false`, zero, minimum, maximum, invalid format, out-of-range value, and conditional show/hide. Verify rejected values produce the correct field error and cannot become a saved valid value. Check units and conversions, option labels versus stored values, date chronology, array add/remove/reorder, and HLA or serology inputs where applicable. Mark a state `not applicable` only with a reason tied to that control. Use separate isolated cases when an invalid value would interfere with another assertion. Each valid edit that queues a new Match run needs its own sealed expected result before the edit is saved.

For every matching input, include at least one independently predicted case that makes its intended rule observable. Where a field should change the result, use a controlled pair of cases with all other clinical inputs and criteria held fixed and independently predict both full results before entry. Where a field should not change matching, compare the corresponding results and verify that it still persists correctly. Check that missing or unknown clinical input yields REVIEW when required by the spec, never PASS. The supervisor checks the field matrix against all cases and evidence. Any unmapped field, missing applicable assertion, failed readback, unexplained validation behavior, or incomplete match-effect check makes field coverage `FAIL` or `BLOCKED`, never `PASS`. Report the tested build and the numerator and denominator of covered fields and assertions; a 100% claim is allowed only when every applicable item has evidence and passes. This is a functional QA gate for the tested build. Clinical production readiness still requires qualified clinical review of the rules and evidence.

## Seal an independent oracle before entry

The supervisor derives `oracle.json` without running, importing, or copying `src/domain/engine.ts`, its rule functions, the live preview, or a saved app result. Use a separately reasoned rule trace from the approved spec and independently reviewed golden vectors or a separately implemented reference calculator. For every expected finding, record the triggering input paths, applicable criterion, source section, and calculation. A second check must confirm the arithmetic and worst-result aggregation. An expectation produced by the same engine under test is a consistency check, never the oracle.

The sealed oracle contains:

- Input SHA-256 hashes and the exact patient, donor, pair, criteria, source, build/engine version, and clock assumptions.
- The full expected `EvaluationResult`: `overall`, ordered `blockers`, all six ordered `rules`, every ordered finding's `code`, `status`, `missing`, `title`, `detail`, `evidence`, and `source`, `missingCount`, and `engineVersion`.
- A trace and source for every field whose value affects a verdict. If exact wording is not specified by the spec, use a previously reviewed golden value with provenance. Do not fill it from the current result.

Time-dependent rules use the app's real clock. Choose inputs whose complete expected result is unchanged throughout the stated execution window, and check the oracle at both ends of that window. Keep dates away from age, recency, expiration, and ischemia boundaries unless the clock can be controlled in the tested environment. If the expected result changes across the window, the case cannot be released for exact comparison. A criteria, build, or clock drift after sealing blocks comparison and requires a new case and oracle.

If any result field cannot be independently predicted, mark the case `BLOCKED: incomplete oracle`. Do not call a partial assertion a 100% match.

## Browser operator procedure

Load `agent-browser skills get core` and `agent-browser skills get dogfood`; also load `agent-browser skills get vercel-sandbox` if running in Vercel Sandbox. Create an isolated named session with `agent-browser session id --scope worktree --prefix clinical-qa` and launch it with `agent-browser --session <id> --headed open <target-url>`. Reuse an existing session only when it is isolated and visibly headed. Before form entry, confirm that the user can actually watch the live browser window or a live stream of that same session. If the browser runs on a remote host, expose the session through the agent-browser dashboard or another secure live view and verify that it is visible to the user. Keep the view available through form entry, save, Match run, and result inspection. A recording or screenshots supplement the live view; they do not satisfy this gate. If no live view is available, stop with `BLOCKED: visible browser unavailable`. Never switch to headless silently.

Confirm the exact origin and authenticated account. Stop with `BLOCKED` if access is unavailable. Do not put credentials or cookies in artifacts. Record the session ID and live-view method in the run report, without recording private dashboard access tokens.

For each released case:

1. Enter the patient and donor through their forms using accessibility labels and normal UI actions. Enter arrays through add-row controls, choose exact displayed options, and set dates as `YYYY-MM-DD`. Do not set React state, browser storage, or server data with scripts or direct write requests.
2. Keep a field ledger with JSON path, intended value, UI label, entry action, pre-save readback, persisted and edit readback, validation result, and evidence. Check each section before moving on. Capture the field-matrix assertions exercised by this case. Ambiguous controls or rejected valid values stop the case.
3. Create each unique record once, then perform only the planned versioned edits needed for the field matrix. If a save times out, search for its `QA-` identifier and current version before retrying. Reload the detail and edit views and compare every persisted field with the fixture or planned edit value. A mismatch here is a form or persistence finding, and the match comparison stops because its input was not the sealed input.
4. Follow the specific Match run or save the checked pair. Wait for a terminal state. Capture the saved result's patient and donor snapshots, pair inputs, criteria version and values, source, engine version, and full result. The UI is primary evidence. Read-only capture of the same-origin response produced by normal UI navigation is allowed when the UI omits structured fields such as finding codes; redact tokens and unrelated records. Never call an undocumented endpoint to create or alter data.
5. Write `observed.json` and screenshots or a short recording with the resulting record and match IDs, URL, UTC time, and input SHA-256. Do not edit the oracle or label the result pass or fail.

If the app exposes only part of the result and the browser cannot capture the rest, mark `BLOCKED: incomplete observation`. Never infer hidden fields from visible text.

## Supervisor comparison and bug files

First compare persisted inputs and saved snapshots with the sealed inputs. Then verify source, pair, criteria version and values, engine version, and time window. Any mismatch invalidates the result comparison and gets its own finding. Do not silently rebase the oracle to the observed app state.

For a valid case, compare the entire expected and observed `EvaluationResult` by structural deep equality. Object key order is irrelevant; array order, strings, numbers, booleans, nulls, finding presence, and all fields must agree exactly. Do not normalize away a mismatch. Report the first and all subsequent differing JSON paths. Only a zero-difference comparison is `PASS`. A mismatch is `FAIL` and a bug candidate. If a clinical status or missing-data marker differs, treat it as a safety-critical finding until reviewed.

Immediately save each match mismatch or failed field assertion in its own `findings/<case-id>-<number>.md` file, plus `expected.json`, `actual.json`, and evidence files. The Markdown file must contain:

1. Short title, severity, status, target URL, UTC time, deployed revision, criteria version, engine version, case ID, run ID, match ID, and fixture/oracle hashes.
2. Exact expected and actual values at every differing JSON path, with the independent rule trace and source.
3. The complete flow from fresh login through patient entry, donor entry, save, Match run or checked-pair save, result navigation, and observation. Name every required form value and pair input or link the immutable fixture.
4. Numbered steps to reproduce with fresh unique `QA-` IDs, the same criteria and valid time window, and expected versus actual results. Include screenshots, network response excerpt with secrets redacted, and video when interaction or timing matters.
5. Whether a second independent replay reproduced it. If replay is unsafe or unavailable, say `not replayed` and why. Do not erase the initial finding.

Stop dependent cases after a mismatch. The supervisor may continue independent cases, but must never count them as passing until they have their own complete oracle and observation. The final report lists `PASS`, `FAIL`, `BLOCKED`, and `NOT TESTED` separately, links each bug file, and gives field and assertion coverage from `field-matrix.json`. Do not call the forms production-ready when any applicable field check is missing or failed.

## Production discipline

Use synthetic `QA-` identifiers and the smallest case set that covers the requested fields and safety boundaries. Never open or modify an existing real record, change criteria, reset data, delete records, seed demo data, or make a clinical decision. Do not include secrets or personal information in reports. Production runs can create persistent records and immutable match results, so log every created ID. A full exact comparison is a software QA result for those inputs and that build, not a guarantee of zero clinical risk.
