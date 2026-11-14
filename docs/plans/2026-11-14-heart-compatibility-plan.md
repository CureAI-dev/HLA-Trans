# HLA-Trans Implementation Plan

> **For agentic workers:** Use subagent-driven-development (recommended) or executing-plans to implement this plan task by task. Steps use checkbox (`- [x]`) syntax.

**Goal:** Build the heart donor–recipient compatibility demo described in the spec.

**Architecture:** A pure TypeScript domain layer (schemas, calculations, HLA, rules, engine) with no React. On top of it, a localStorage repository. On top of that, TanStack Start routes built with shadcn components. Domain code is fully unit-tested before any UI uses it.

**Tech stack:** TanStack Start 1.169 (React 19), shadcn (Base UI, lyra), Tailwind v4, zod 4.6, vitest 5, Bun.

**Spec:** `docs/specs/2026-11-14-heart-compatibility-spec.md`

## Global constraints
- Missing input → REVIEW with `missing: true`. Never PASS.
- Stored units: cm, kg, mmHg, L/min, L/min/m², WU, mcg/kg/min (vasopressin units/h), mmol/L, ng/mL, minutes.
- `null` = not recorded. Never coerce to 0.
- Domain files (`src/domain/**`) must not import React or browser APIs.
- Every rule finding has `code`, `status`, `missing`, `title`, `detail`, `evidence`, `source`.
- Status colours (`pass`, `caution`, `fail`, `unknown` tokens) are used for status only, always with an icon and a word.
- Each commit passes: `bun run typecheck`, `bun run lint`, `bun run test`.
- No code references to OPTN allocation ranking. Screening order is labelled "not OPTN allocation".
- **SSR is off** (`defaultSsr: false` + SPA mode). Route components run only in the browser, so they may read localStorage directly. No hydration gate, no null server snapshot. The root `shellComponent` still renders on the server, so it must not touch browser APIs.

## Progress (2026-11-14)

Tasks 1–5 are implemented and verified. Initial audit found tasks 1–3 already committed, task 4 drafted with two failing tests and three lint errors, and task 5 drafted without tests. Existing implementations were preserved and reviewed before completing the gaps with separate implementer and reviewer sub-agents.

- Task 1: verified test tooling, client-only rendering, production SPA shell, and served HTML without route content.
- Task 2: verified schemas/factories and added strict calendar-date validation (`2ab400f`).
- Task 3: verified reference calculations, fixed invalid-date handling and minute rounding, extended PHM/ischemia coverage (`7f02b73`), and preserved missing post-challenge PVR/OCS perfusion inputs as null (`e3e4d5d`).
- Task 4: fixed parsing, null-allele mismatches, uncertain typing, Bw derivation, and locus validation (`0689b21`).
- Task 5: added defaults, descriptor uniqueness, schema, and ordering-boundary tests (`352c177`).

Verification: 166 tests pass; typecheck, lint, and production build pass. Implementation remains on `feat/heart-compatibility-tasks-1-5`. Tasks 6 onward remain pending.

## Original draft inventory (before Task 1)

The following files were drafted before implementation began. The task column identifies where each is reviewed and tested.

| File | Task that verifies it |
|---|---|
| `src/domain/options.ts` | Task 2 |
| `src/domain/schema.ts` | Task 2 |
| `src/domain/calc.ts` | Task 3 |
| `src/domain/hla.ts` | Task 4 |
| `src/domain/criteria.ts` | Task 5 |
| `src/lib/storage/local-store.ts` | Task 12 |
| `src/styles.css` (theme tokens, fonts) | Task 14 |
| `package.json` (zod, IBM Plex, vitest added) | Task 1 |

## File map

```
src/
  domain/                      pure TS, no React
    options.ts                 vocabularies (OPTN codes, labels)
    schema.ts                  zod schemas + inferred types
    calc.ts                    BMI, BSA, PHM, hemodynamics, ischemia
    hla.ts                     parse, equivalence, profile, crossmatch
    criteria.ts                defaults, field descriptors, validation
    factories.ts               emptyPatient(), emptyDonor(), defaultPair()
    rules/
      findings.ts              finding builders, worst()
      context.ts               RuleContext type
      abo.ts  size.ts  immunology.ts  infection.ts  donor-heart.ts  logistics.ts
    engine.ts                  evaluate(), blockers, screenDonor()
    sample-data.ts             realistic demo records
    __tests__/                 vitest specs, one per module
  lib/storage/
    local-store.ts             generic zod-validated localStorage store
    db.ts                      the app database store + actions + audit
  components/
    app/                       shell, sidebar, header, status badge, verdict strip
    form/                      field kit (number, select, tri, serology, HLA grid, …)
    patient/  donor/  evaluation/  criteria/
  routes/                      TanStack file routes
```

---

### Task 1: Test tooling and client-only rendering

**Files:**
- Modify: `package.json` (scripts)
- Create: `vitest.config.ts`
- Create: `src/domain/__tests__/smoke.test.ts`
- Create: `src/start.ts`
- Modify: `vite.config.ts`

- [x] **Step 0: Turn SSR off**
```ts
// src/start.ts
import { createStart } from "@tanstack/react-start"
export const startInstance = createStart(() => ({ defaultSsr: false }))
```
```ts
// vite.config.ts
tanstackStart({ spa: { enabled: true } })
```
Check: `bun run build` succeeds and outputs the SPA shell. `bun run dev`: page HTML from the server holds no route content.

- [x] **Step 1: Add scripts**
```json
"test": "vitest run",
"test:watch": "vitest"
```
- [x] **Step 2: Create `vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
})
```
- [x] **Step 3: Smoke test**
```ts
import { expect, test } from "vitest"
test("vitest runs", () => expect(1 + 1).toBe(2))
```
- [x] **Step 4:** Run `bun run test`. Expected: 1 passed.
- [x] **Step 5:** Run `bun run typecheck`. Fix any errors in drafted files that block compilation. Expected: 0 errors.
- [x] **Step 6: Commit** `chore: vitest, test scripts and client-only rendering`

---

### Task 2: Vocabularies and schemas

**Files:**
- Review: `src/domain/options.ts`, `src/domain/schema.ts`
- Create: `src/domain/factories.ts`
- Test: `src/domain/__tests__/schema.test.ts`

**Interfaces produced:**
```ts
// factories.ts
export function emptyPatient(now?: Date): Patient       // valid except required identity fields are ""
export function emptyDonor(now?: Date): Donor
export function emptyHlaTyping(): HlaTyping
export function defaultPairInputs(): PairInputs           // all times null, static_cold, crossmatch not_done
export function newId(prefix: "pat" | "don" | "evl" | "crv" | "aud" | "ab" | "va"): string  // crypto.randomUUID based
```

- [x] **Step 1: Write failing tests**
```ts
import { describe, expect, test } from "vitest"
import { patientSchema, donorSchema, dbSchema } from "../schema"
import { emptyPatient, emptyDonor } from "../factories"

describe("schemas", () => {
  test("empty patient fails only on required identity fields", () => {
    const r = patientSchema.safeParse(emptyPatient())
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join("."))
    expect(paths.sort()).toEqual(
      ["identity.dateOfBirth", "identity.firstName", "identity.lastName", "identity.mrn"].sort()
    )
  })
  test("filled patient passes", () => {
    const p = emptyPatient()
    p.identity = { ...p.identity, mrn: "M1", firstName: "A", lastName: "B", dateOfBirth: "1970-01-01" }
    expect(patientSchema.safeParse(p).success).toBe(true)
  })
  test("donor requires donorId", () => {
    const d = emptyDonor()
    expect(donorSchema.safeParse(d).success).toBe(false)
    d.identity.donorId = "D-1"
    expect(donorSchema.safeParse(d).success).toBe(true)
  })
  test("null numbers are allowed, NaN is not", () => {
    const d = emptyDonor(); d.identity.donorId = "D-1"
    d.echo.lvef = null
    expect(donorSchema.safeParse(d).success).toBe(true)
    d.echo.lvef = Number.NaN
    expect(donorSchema.safeParse(d).success).toBe(false)
  })
  test("db requires at least one criteria version", () => {
    const r = dbSchema.safeParse({ schemaVersion: 1, clinicianName: "", patients: [], donors: [], evaluations: [], criteriaVersions: [], audit: [] })
    expect(r.success).toBe(false)
  })
})
```
- [x] **Step 2:** Run `bun run test schema`. Expected: FAIL (factories missing).
- [x] **Step 3:** Implement `factories.ts`. All numeric fields `null`, booleans `false`, tri fields `"unknown"`, serology `"not_done"`, enums at their "unknown/none" value, `listing.state = "evaluation"`, `donor.identity.state = "available"`, `acceptance.acceptDcd = true`, other accept flags `false`.
- [x] **Step 4:** Run tests. Expected: PASS.
- [x] **Step 5: Commit** `feat(domain): schemas, vocabularies and factories`

---

### Task 3: Derived calculations

**Files:** Review `src/domain/calc.ts`. Test `src/domain/__tests__/calc.test.ts`

**Interfaces (already drafted):** `bmi`, `bmiCategory`, `bsaMosteller`, `bsaDuBois`, `predictedHeartMass`, `patientHemodynamics`, `effectivePvr`, `estimateIschemia`, `ageInYears`, `ageInYearsExact`, `patientPhm`, `donorPhm`, `formatMinutes`, `round`.

- [x] **Step 1: Tests**
```ts
import { describe, expect, test } from "vitest"
import * as c from "../calc"

describe("PHM (Reed 2014 worked example)", () => {
  test("male 55y 175cm 80kg", () => {
    const r = c.predictedHeartMass({ sex: "male", ageYears: 55, heightCm: 175, weightKg: 80 })!
    expect(r.lv).toBeCloseTo(161.65, 1); expect(r.rv).toBeCloseTo(23.42, 1); expect(r.total).toBeCloseTo(185.07, 1)
  })
  test("female 55y 175cm 80kg", () => {
    const r = c.predictedHeartMass({ sex: "female", ageYears: 55, heightCm: 175, weightKg: 80 })!
    expect(r.total).toBeCloseTo(155.68, 1)
  })
  test("missing or zero inputs return null", () => {
    expect(c.predictedHeartMass({ sex: "male", ageYears: null, heightCm: 175, weightKg: 80 })).toBeNull()
    expect(c.predictedHeartMass({ sex: "male", ageYears: 0, heightCm: 175, weightKg: 80 })).toBeNull()
  })
})
describe("BSA and BMI", () => {
  test("Mosteller 180/80 = 2.0", () => expect(c.bsaMosteller(180, 80)).toBeCloseTo(2.0, 3))
  test("DuBois 180/80", () => expect(c.bsaDuBois(180, 80)).toBeCloseTo(1.9964, 3))
  test("BMI 180/81 = 25.0", () => expect(c.bmi(180, 81)).toBeCloseTo(25.0, 2))
  test("BMI category boundaries", () => {
    expect(c.bmiCategory(18.49)).toBe("Underweight"); expect(c.bmiCategory(25)).toBe("Overweight")
    expect(c.bmiCategory(35)).toBe("Obesity class II")
  })
})
describe("age", () => {
  test("birthday not yet reached", () => expect(c.ageInYears("1980-06-15", new Date("2026-06-14T12:00:00Z"))).toBe(45))
  test("on birthday", () => expect(c.ageInYears("1980-06-15", new Date("2026-06-15T12:00:00Z"))).toBe(46))
  test("future DOB is null", () => expect(c.ageInYears("2030-01-01", new Date("2026-01-01"))).toBeNull())
})
```
Plus hemodynamics: patient with paSys 50, paDia 20, paMean null, pcwp 18, CO 4 → paMean 30 (derived), TPG 12, DPG 2, PVR 3.0. Vasodilator challenge done with pvrAfterChallenge 2.1 → `effectivePvr` = 2.1.
Plus ischemia: procurement 30, transport 120, implant 60, 1 prior sternotomy, durable LVAD, criteria extras 45/60 → total 315. OCS with perfusion 200 → cold 115. Any time null → null.
- [x] **Step 2:** Run. Fix `calc.ts` until all pass.
- [x] **Step 3: Commit** `feat(domain): clinical calculations with reference vectors`

---

### Task 4: HLA parsing, equivalence, virtual crossmatch

**Files:** Review `src/domain/hla.ts`. Test `src/domain/__tests__/hla.test.ts`

**Interfaces (drafted):** `parseHla(raw, locus?)`, `normalizeHla`, `specLabel`, `withAncestors`, `ancestorsOf`, `isBroad`, `splitsOf`, `alleleToSerologic`, `buildProfile(typing)`, `donorCarries(target, profile)`, `abDrMismatches(donor, recipient)`.

- [x] **Step 1: Tests (table-driven)**

| Input | Locus | Expected label |
|---|---|---|
| `a2` | — | `A2` |
| `2` | A | `A2` |
| `02:01` | A | `A*02:01` |
| `HLA-A*02:01:01:02L` | — | `A*02:01L` |
| `cw9` | — | `Cw9` |
| `9` | C | `Cw9` |
| `DR15` | — | `DR15` |
| `4*01:01` | DRB345 | `DRB4*01:01` |
| `DPB1*04:01` | — | `DPB1*04:01` |
| `A99` | — | error "not a recognized serologic antigen" |
| `xyz` | — | error |

Serologic mapping: `B*15:01→B62`, `B*15:03→B72`, `B*15:99→B15` (broad), `B*40:05→B4005`, `C*03:03→Cw9`, `DRB1*03:01→DR17`, `DQB1*03:02→DQ8`, `DRB4*01:01→DR53`, `A*24:02→A24`.

Ancestors: `withAncestors("B71")` = `["B71","B70","B15"]`; `withAncestors("A43")` = `["A43","A10"]`; `withAncestors("B4005")` = `["B4005","B50","B21"]`.

Crossmatch (`donorCarries`), donor typing A `["A*02:01","A*24:02"]`, B `["B15","B44"]`, rest empty:

| Target | Expected |
|---|---|
| `A9` | definite (A24 ⊂ A9) |
| `A24` | definite |
| `A*24:02` | definite |
| `A*24:03` | none (A typed at 2-field) |
| `A23` | none |
| `B62` | possible (donor only B15 broad) |
| `B15` | definite |
| `B12` | definite (B44) |
| `Bw4` | definite (B44 is Bw4) |
| `Cw7` | possible (C not typed) |
| `DR15` | possible (DRB1 not typed) |

Null allele: donor A `["A*24:09N","A*02:01"]` → profile excludes A24; `nullAlleles` = `["A*24:09N"]`.
Mismatches: donor A `A1,A2` / B `B8,B44` / DR `DR15,DR4` vs recipient A `A2,A3` / B `B7,B44` / DR `DR15,DR7` → `{A:1,B:1,DR:1,total:3}`.
- [x] **Step 2:** Run, fix `hla.ts` until green.
- [x] **Step 3: Commit** `feat(domain): HLA parsing, OPTN equivalence and virtual crossmatch`

---

### Task 5: Criteria defaults and validation

**Files:** Review `src/domain/criteria.ts`. Test `src/domain/__tests__/criteria.test.ts`

- [x] **Step 1: Tests**
```ts
import { expect, test } from "vitest"
import { DEFAULT_CRITERIA, CRITERIA_FIELDS, validateCriteria } from "../criteria"
import { criteriaSchema } from "../schema"

test("defaults satisfy schema and ordering rules", () => {
  expect(criteriaSchema.safeParse(DEFAULT_CRITERIA).success).toBe(true)
  expect(validateCriteria(DEFAULT_CRITERIA)).toEqual([])
})
test("every criteria key has exactly one descriptor", () => {
  const described = new Set(CRITERIA_FIELDS.map((f) => `${f.section}.${f.key}`))
  const actual = Object.entries(DEFAULT_CRITERIA).flatMap(([s, o]) => Object.keys(o).map((k) => `${s}.${k}`))
  expect([...described].sort()).toEqual(actual.sort())
})
test("inverted thresholds are reported", () => {
  const bad = structuredClone(DEFAULT_CRITERIA)
  bad.immunology.mfiReviewMin = 6000
  expect(validateCriteria(bad).map((i) => i.path)).toContain("immunology.mfiFailMin")
})
```
- [x] **Step 2:** Run, fix.
- [x] **Step 3: Commit** `feat(domain): default criteria with sources and validation`

---

### Task 6: Rule scaffolding + Blood type rule

**Files:**
- Create: `src/domain/rules/findings.ts`, `src/domain/rules/context.ts`, `src/domain/rules/abo.ts`
- Test: `src/domain/__tests__/rules-abo.test.ts`
- Create: `src/domain/__tests__/builders.ts` (test helpers: `patient(overrides)`, `donor(overrides)`, deep-merge on factories, with valid identity filled)

**Interfaces produced:**
```ts
// context.ts
export type RuleContext = { patient: Patient; donor: Donor; pair: PairInputs; criteria: Criteria; now: Date }
// findings.ts
export type FindingInput = Omit<Finding, "missing" | "evidence" | "source"> & Partial<Pick<Finding, "missing" | "evidence" | "source">>
export function finding(input: FindingInput): Finding
export function missingFinding(code: string, title: string, detail: string, source?: string): Finding // status "review", missing true
export function outcomeFinding(outcome: Outcome, input: Omit<FindingInput, "status">): Finding
export function worst(findings: ReadonlyArray<Pick<Finding, "status">>): Outcome  // info→pass; [] → pass
export function ruleResult(rule: RuleId, findings: Array<Finding>): RuleResult
// abo.ts
export function evaluateAbo(ctx: RuleContext): RuleResult
export function aboCompatible(donor: Abo, recipient: Abo): boolean
export function aboPriority(donor: Abo, recipient: Abo): "primary" | "secondary" | "incompatible"
```

- [ ] **Step 1: Tests.** Cover every row of spec §6.1:
  - all 16 donor×recipient combos for `aboCompatible` (table test)
  - `aboPriority("O","B")` = primary, `("O","A")` = secondary, `("A","B")` = incompatible
  - missing ABO → review + missing
  - not verified → review
  - identical → pass
  - A→B adult → fail
  - pediatric age 0.5, opted in, A→B → review
  - pediatric age 5, recipient B, donor A: anti-A 1:8 dated 10 days ago, no therapy → review; titer 1:32 → fail; titer dated 40 days ago → review missing; therapy within 30 days → fail
  - pediatric pathway disabled in criteria → fail
- [ ] **Step 2:** Run. Expected: fail.
- [ ] **Step 3:** Implement per spec §6.1. Pediatric = age at listing date < 18 if listing date set, else current age < 18. Titer age uses `ctx.now`.
- [ ] **Step 4:** Run. Expected: pass.
- [ ] **Step 5: Commit** `feat(rules): finding helpers and blood type rule`

---

### Task 7: Size rule

**Files:** Create `src/domain/rules/size.ts`. Test `src/domain/__tests__/rules-size.test.ts`

**Interface:** `export function evaluateSize(ctx: RuleContext): RuleResult`

- [ ] **Step 1: Tests** (spec §6.2):
  - adult, PHM ratio 1.0 → pass; info findings include weight ratio
  - ratio 0.80 → review; 0.65 → fail; 1.4 → review (oversized)
  - PVR 5 (derived) with ratio 0.92 → review; post-challenge PVR 3 with ratio 0.92 → pass
  - PHM not computable (donor height null) → weight fallback: 0.85 pass, 0.75 review, 0.6 fail
  - female donor → male recipient, fallback weight ratio 0.78 → review
  - all size data missing → review missing
  - pediatric recipient age 8, weight ratio 2.5 → pass; 3.5 → fail
  - donor weight 60, patient acceptance min 65 → fail
- [ ] **Step 2–4:** Fail → implement → pass. Evidence strings show values to 2 decimals (e.g. `PHM ratio 0.82 (donor 152 g / recipient 185 g)`).
- [ ] **Step 5: Commit** `feat(rules): size rule with PHM and pulmonary hypertension adjustment`

---

### Task 8: HLA and antibody rule

**Files:** Create `src/domain/rules/immunology.ts`. Test `src/domain/__tests__/rules-immunology.test.ts`

**Interface:** `export function evaluateImmunology(ctx: RuleContext): RuleResult`

- [ ] **Step 1: Tests** (spec §6.3), donor typing as in Task 4:
  - unacceptable `A9` → fail; unacceptable `B62` → review (possible)
  - antibody `B44` MFI 6000 → fail; MFI 3000 → review; MFI 3000 + C1q positive → fail; MFI 1500 → pass with info "1 antibody below review level"
  - antibody `A23` MFI 9000 → pass (not DSA)
  - antibodies present, donor fully untyped → review missing
  - no antibodies, cPRA null → review missing; cPRA 40 → review missing; cPRA 0 → pass
  - CDC positive → fail; flow positive only → review
  - invalid typing value `"Q12"` in donor A → review
- [ ] **Step 2–4:** Fail → implement → pass. One finding per DSA / unacceptable hit. Findings sorted fail → review → info.
- [ ] **Step 5: Commit** `feat(rules): virtual crossmatch rule`

---

### Task 9: Infection rule

**Files:** Create `src/domain/rules/infection.ts`. Test `src/domain/__tests__/rules-infection.test.ts`

**Interface:** `export function evaluateInfection(ctx: RuleContext): RuleResult`

- [ ] **Step 1: Tests** (spec §6.4). Base fixture: all donor tests negative, recipient CMV/EBV/Toxo done, sample within 96 h → pass. Then one change per test:
  - one required test not done → review missing (code `infection.missing.hbvNat`)
  - Chagas endemic yes + not done → review missing
  - sample not within 96 h → review
  - HIV NAT positive → fail; same with recipient HIV positive + protocol → review
  - HCV NAT positive → review; with `acceptHcvNat=false` → fail
  - anti-HBc only → review; opt-out → fail
  - CMV D+/R− → review; D+/R+ → info
  - Toxo D+/R− → review
  - Chagas positive → fail; WNV positive → fail
  - CNS `viral_fungal_amebic` → fail
  - PHS criterion `idu` → review; `acceptPhsRisk=false` → fail
  - indeterminate HBsAg → review
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(rules): infectious disease rule`

---

### Task 10: Donor heart rule

**Files:** Create `src/domain/rules/donor-heart.ts`. Test `src/domain/__tests__/rules-donor-heart.test.ts`

**Interface:** `export function evaluateDonorHeart(ctx: RuleContext): RuleResult`

- [ ] **Step 1: Tests** (spec §6.5). Base fixture: 30-year-old male, LVEF 60, walls 10/10, normal valves/RV/wall motion, angio not done, sodium 142/145, norepinephrine 0.05 only, no arrest, troponin 0.1, malignancy none → pass. Then one change each:
  - age 50 → review; patient maxDonorAge 45 → fail; criteria ageFailAbove 48 → fail
  - LVEF 45 → review; 35 → fail; LVEF 35 with repeat 55 → pass (info notes initial)
  - wall 15 → review; 18 → fail
  - valve moderate → fail; coronary anomaly yes → fail
  - angio abnormal, 2 vessels → fail; 1 vessel → review; abnormal with vessels null → review missing
  - age 42 male, angio not done → review missing ("angiography indicated")
  - sodium peak 171 → fail; latest 127 → fail; peak 160 → review
  - norepinephrine 0.2 → review; dobutamine 5 + norepinephrine 0.05 → review; dose null → review missing
  - VA-ECMO ongoing → fail
  - arrest yes, CPR 40, LVEF 45 → review (plus LVEF review); CPR null → review missing
  - troponin 2.0 → review
  - CO poisoning with COHb 45 → fail; COHb null → review missing
  - malignancy high → fail; intermediate → review
  - cocaine yes + wall 14 → review
  - unexplained sudden death → review
  - donor 52, recipient 30 → info finding `donorHeart.olderDonorYoungerRecipient` (status stays pass)
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(rules): donor heart quality rule`

---

### Task 11: Logistics rule and engine

**Files:**
- Create `src/domain/rules/logistics.ts`, `src/domain/engine.ts`
- Test `src/domain/__tests__/rules-logistics.test.ts`, `src/domain/__tests__/engine.test.ts`

**Interfaces produced:**
```ts
export function evaluateLogistics(ctx: RuleContext): RuleResult
export const ENGINE_VERSION = "1.0.0"
export function evaluate(input: { patient: Patient; donor: Donor; pair: PairInputs; criteria: Criteria; now?: Date }): EvaluationResult
export type ScreenRow = {
  patient: Patient
  result: EvaluationResult
  aboPriority: "primary" | "secondary" | "incompatible"
  isPediatricCandidate: boolean
  /** Days at current urgency status; null if neither status date nor listing date is set. */
  daysAtStatus: number | null
  /** True when daysAtStatus fell back to the listing date. */
  daysAtStatusFromListing: boolean
}
export function isPediatricCandidate(patient: Patient, now: Date): boolean
// age at listing date < 18; if no listing date, current age < 18 (OPTN 6.1–6.2)
export function daysAtStatus(patient: Patient, now: Date): { days: number | null; fromListing: boolean }
export function screenDonor(donor: Donor, patients: ReadonlyArray<Patient>, criteria: Criteria, now?: Date): Array<ScreenRow>
// Sort (spec §6.7):
// 1. overall: pass < review < fail
// 2. URGENCY_RANK (A1 = P1A, A3 = P1B, A6 = P2); missing status sorts last
// 3. donor age < 18 only: pediatric candidates before adults at equal rank
// 4. aboPriority: primary < secondary < incompatible
// 5. daysAtStatus descending; null last
// 6. patient id (stable tie-break)
// Only patients with listing.state === "active" are screened.
```

- [ ] **Step 1: Logistics tests** (spec §6.6): times null → review missing; 210 min → pass; 300 → review; 400 → fail; 400 with OCS perfusion 200 → pass (cold 200) + info; donor 50 y and 250 min → review; DCD with acceptDcd false → fail; DCD fWIT 25 → pass, 40 → review, 50 → fail, null → review missing; distance 600 with max 500 → fail.
- [ ] **Step 2: Engine tests:**
  - blockers: patient inactive → overall fail, blocker code `blocker.patientState`
  - overall equals worst rule
  - `missingCount` equals the count of missing findings across rules
  - `result` validates against `evaluationResultSchema`
  - `screenDonor` ordering, all with overall PASS unless stated:
    - A1 before A4 regardless of age (60-year-old A1 ranks above 20-year-old A4)
    - same rank A3, one P1B child and one adult, **adult donor** → order by ABO priority then time at status (no age preference)
    - same rank A3/P1B, **donor age 15** → child first
    - donor O: recipient B (primary) before recipient A (secondary) at equal rank
    - equal everything: 90 days at status before 10 days
    - status date missing → falls back to listing date, `daysAtStatusFromListing = true`
    - REVIEW result ranks below PASS even at higher urgency
    - inactive patient is excluded
  - `isPediatricCandidate`: listed at 17, now 19 → true; no listing date, age 16 → true; listed at 18 → false
  - performance: 200 patients screened in < 1000 ms
- [ ] **Step 3–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(domain): logistics rule, engine and donor screening`

---

### Task 12: Database store and actions

**Files:**
- Review `src/lib/storage/local-store.ts`
- Create `src/lib/storage/db.ts`
- Test `src/lib/storage/__tests__/db.test.ts` (uses an in-memory `Storage` stub assigned to `globalThis.window`)

**Interfaces produced:**
```ts
export const DB_KEY = "hla-trans.db.v1"
export const dbStore: LocalStore<Db>
export function useDb(): Db   // SSR is off: always available in route components
export function initialDb(): Db   // one criteria version (v1, DEFAULT_CRITERIA, author "System")
export const actions: {
  setClinician(name: string): void
  savePatient(p: Patient): Patient          // insert or update, stamps updatedAt, audit
  deletePatient(id: string): void           // blocked if referenced by an undecided evaluation? No: evaluations keep snapshots, delete allowed; audit
  saveDonor(d: Donor): Donor
  deleteDonor(id: string): void
  createEvaluation(patientId: string, donorId: string, pair: PairInputs): Evaluation  // runs engine with latest criteria, stores snapshots
  decide(evaluationId: string, decision: Omit<Decision, "decidedAt">): Evaluation   // throws if already decided
  publishCriteria(criteria: Criteria, changeNote: string): CriteriaVersion          // throws on validateCriteria issues
  importDb(raw: unknown): { patients: number; donors: number; evaluations: number } // zod-validated, replaces all
  exportDb(): string                         // pretty JSON
  loadSampleData(): void                     // merges sample records, skips existing ids
  reset(): void
}
export function latestCriteria(db: Db): CriteriaVersion
```
Errors: `StorageWriteError` propagates. Domain errors throw `DbActionError` with a user-readable message.

- [ ] **Step 1: Tests:** corrupt JSON in storage → store loads `initialDb()`, backup key written, `recoveryNotice()` non-null; save + reload round-trip; `decide` twice throws; `publishCriteria` increments version; evaluation snapshot unchanged after patient edit; import of invalid JSON throws and leaves data intact; every action writes an audit entry; quota error (stub throws `QuotaExceededError`) → `StorageWriteError`.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(storage): validated local database with audit trail`

---

### Task 13: Sample data

**Files:** Create `src/domain/sample-data.ts`. Test `src/domain/__tests__/sample-data.test.ts`

**Interface:** `export const SAMPLE_PATIENTS: Patient[]; export const SAMPLE_DONORS: Donor[]; export const SAMPLE_PAIRS: Array<{ patientId: string; donorId: string; pair: PairInputs; expected: Outcome; why: string }>`

Records (fictional, clearly labelled):
- 6 patients: adult status 1 on VA-ECMO (O, cPRA 0); adult status 2 IABP highly sensitized (A, cPRA 78, antibodies incl. A24 8000, B62 3500, unacceptable A9); adult status 3 durable LVAD + 1 prior sternotomy (B); adult status 4 amyloid with PVR 4.8 (AB); pediatric 1A age 0.6 opted in ABO-incompatible (B); inactive adult status 6 (O).
- 5 donors: ideal 28 y DBD male O; 52 y female A with LVEF 45 and single-vessel CAD; 34 y male B HCV NAT+; DCD 31 y male O fWIT 24 TA-NRP; 46 y male A with CO poisoning COHb 22, troponin 0.4.
- ≥ 8 pairs covering pass, review and fail for each rule group.

- [ ] **Step 1:** Test: all records validate; every `SAMPLE_PAIRS` entry evaluates to `expected`.
- [ ] **Step 2–4:** Write data → pass.
- [ ] **Step 5: Commit** `feat(domain): realistic sample dataset`

---

### Task 14: App shell and design system

**Files:**
- Modify `src/routes/__root.tsx`, `src/styles.css`, `src/routes/index.tsx`
- Create `src/components/app/app-shell.tsx`, `app-sidebar.tsx`, `clinician-control.tsx`, `status.tsx` (StatusBadge, StatusIcon, VerdictStrip), `page-header.tsx`, `demo-banner.tsx`, `theme-toggle.tsx`

**Interfaces produced:**
```tsx
<StatusBadge status="pass|review|fail|info" missing?: boolean />
<VerdictStrip rules={RuleResult[]} />            // 6 labelled segments, keyboard focusable, links to #rule-id
<PageHeader title description? actions? breadcrumbs? />
```
- Sidebar items: Dashboard, Patients, Donors, New evaluation, Evaluations, Criteria, Audit log, Data. Mobile: sheet.
- Root: `TooltipProvider`, `Toaster`, title "HLA-Trans", devtools only in dev.
- Recovery notice from storage shown as a destructive `Alert` on first load.

- [ ] **Step 1:** Build. **Step 2:** `bun run dev`, open in browser, verify: sidebar nav, dark mode, keyboard focus visible, no hydration warnings in console. **Step 3:** typecheck + lint. **Step 4: Commit** `feat(ui): app shell, status components and theme`

---

### Task 15: Form field kit

**Files:** Create in `src/components/form/`:
`number-field.tsx`, `text-field.tsx`, `date-field.tsx`, `select-field.tsx` (native select with optgroups from `Option.group`), `tri-field.tsx` (ToggleGroup Yes/No/Unknown), `switch-field.tsx`, `serology-grid.tsx`, `hla-typing-grid.tsx`, `antibody-table.tsx`, `vasoactive-list.tsx`, `derived-value.tsx`, `form-section.tsx` (anchored section + side nav), `use-form-state.ts`

**Interfaces produced:**
```ts
function useFormState<T>(initial: T, schema: z.ZodType<T>): {
  value: T; set: <P extends Path<T>>(path: P, v: PathValue<T, P>) => void
  errors: Record<string, string>; dirty: boolean; validate(): T | null; reset(next: T): void
}
```
```tsx
<NumberField label unit value={number|null} onChange min max step error hint />   // empty input → null; rejects non-numeric; shows unit addon
<HlaTypingGrid value={HlaTyping} onChange />  // normalizes on blur via normalizeHla; invalid cell shows message
<AntibodyTable value={Antibody[]} onChange /> // add row, delete row, paste "A2 8000, B44 3500"
```
- Unsaved-changes guard via TanStack Router `useBlocker` when `dirty`.

- [ ] **Step 1:** Unit test the pure parts: `parseAntibodyPaste("A2 8000, B44:3500; DQ7 1200")` → 3 rows; invalid tokens reported. **Step 2:** Build components. **Step 3:** typecheck + lint. **Step 4: Commit** `feat(ui): clinical form field kit`

---

### Task 16: Patient screens

**Files:** Create routes `src/routes/patients/index.tsx`, `patients/new.tsx`, `patients/$patientId.tsx`, `patients/$patientId.edit.tsx`; components `src/components/patient/patient-form.tsx`, `patient-summary.tsx`, `patient-table.tsx`

- List: search (name/MRN), filter by state and ABO, columns: name, MRN, age, ABO, status, cPRA, device, listed date. Empty state with "Add patient" and "Load sample data".
- Form: all spec §4.1 sections; live derived values (BMI, BSA, PHM, TPG, PVR, DPG, PVRI, CI); save → toast "Patient saved" → detail page.
- Detail: summary cards per section, evaluations involving this patient, "Evaluate against a donor".

- [ ] Steps: build → browser check (create, edit, validation errors, unsaved guard, delete with AlertDialog) → typecheck/lint → **Commit** `feat(ui): patient list, form and detail`

---

### Task 17: Donor screens

**Files:** Routes `src/routes/donors/index.tsx`, `donors/new.tsx`, `donors/$donorId.tsx`, `donors/$donorId.edit.tsx`; components `src/components/donor/donor-form.tsx`, `donor-summary.tsx`, `donor-table.tsx`, `screening-table.tsx`

- Form: all spec §4.2 sections incl. PHS 10-item checklist and OPTN test panel grid.
- Detail: tabs "Summary" and "Screen candidates". Screening uses `screenDonor` with latest criteria and default pair inputs. Columns: rank, patient, urgency, pediatric badge, ABO priority (primary/secondary), days at status (with "from listing date" note on fallback), overall, per-rule mini status. Row action "Open full evaluation" → New evaluation prefilled. Banner: "Screening order, not OPTN allocation. Distance circles are not applied. Logistics are not assessed until pair inputs are entered." When the donor is under 18, a line explains "Pediatric candidates are ranked first within each urgency level (OPTN Table 6-8)."

- [ ] Steps: build → browser check → typecheck/lint → **Commit** `feat(ui): donor list, form, detail and candidate screening`

---

### Task 18: Evaluation flow and decision

**Files:** Routes `src/routes/evaluations/new.tsx` (search params `patientId`, `donorId` validated with zod), `evaluations/index.tsx`, `evaluations/$evaluationId.tsx`; components `src/components/evaluation/pair-picker.tsx`, `pair-inputs-form.tsx`, `result-view.tsx`, `rule-card.tsx`, `side-by-side.tsx`, `ischemia-breakdown.tsx`, `decision-form.tsx`

- New: pick patient + donor (comboboxes), pair inputs, **live preview** of the result as inputs change, "Save evaluation" creates a frozen record.
- Result: overall verdict, VerdictStrip, missing-data list with links, 6 RuleCards (findings with status, evidence, source), side-by-side comparison, ischemia breakdown, criteria version used.
- Decision form: verdict (accept/decline/defer), reason codes (required for decline), clinician (prefilled), rationale (required), checkbox "I have reviewed all FAIL and REVIEW findings" (required when any exist). After a decision is saved it is read-only.
- History: table with filters (verdict, decided/pending, date).

- [ ] Steps: build → browser check with sample pairs (each expected verdict appears) → typecheck/lint → **Commit** `feat(ui): evaluation, results and decision recording`

---

### Task 19: Criteria editor

**Files:** Route `src/routes/criteria.tsx`; components `src/components/criteria/criteria-form.tsx`, `criteria-history.tsx`, `criteria-diff.tsx`

- Tabs per section from `CRITERIA_SECTIONS`; fields from `CRITERIA_FIELDS` with source text under each.
- Inline zod + `validateCriteria` errors; Publish needs a change note; confirmation dialog shows the diff.
- History: version list (version, author, date, note), diff vs previous.
- Banner: "Changing criteria does not change past evaluations."

- [ ] Steps: build → browser check (invalid ordering blocked, publish creates v2, old evaluation still shows v1) → typecheck/lint → **Commit** `feat(ui): versioned criteria editor`

---

### Task 20: Dashboard, audit log, data management

**Files:** `src/routes/index.tsx`, `src/routes/audit.tsx`, `src/routes/data.tsx`

- Dashboard: counts, pending decisions list, recent evaluations, outcome mix chart (pass/review/fail), storage usage.
- Audit: filterable table (action, date range, text).
- Data: Export (downloads `hla-trans-YYYY-MM-DD.json`), Import (file → validate → preview counts → confirm replace), Load sample data, Reset (type `RESET` to confirm).

- [ ] Steps: build → browser check (export → reset → import restores) → typecheck/lint → **Commit** `feat(ui): dashboard, audit log and data management`

---

### Task 21: Final QA

- [ ] `bun run typecheck && bun run lint && bun run test`: all green
- [ ] `bun run build`: succeeds
- [ ] Browser walkthrough of every screen in light and dark, at 375 px and 1440 px
- [ ] Keyboard-only pass: sidebar, forms, decision form, dialogs
- [ ] Console: no errors or hydration warnings
- [ ] Update `README.md`: what it is, how to run, safety disclaimer, link to spec
- [ ] **Commit** `docs: readme and QA fixes`

---

## Self-review

| Spec section | Task |
|---|---|
| §3 safety rules | 6–12 (missing→review, snapshots, audit), 18 (decision gate) |
| §4 data model | 2, 12 |
| §5 calculations | 3 |
| §6.0–6.6 rules | 6–11 |
| §6.7 screening order (urgency, pediatric priority, ABO, time at status) | 11 (engine), 17 (screen UI) |
| §7 screens | 14–20 |
| §7.1 visual design | 14 |
| §8 non-functional | 1 (SSR off), 11 (perf), 12 (storage), 21 |
| §9 open items | surfaced as "Center practice" sources in Task 5 and in Criteria UI (Task 19) |
