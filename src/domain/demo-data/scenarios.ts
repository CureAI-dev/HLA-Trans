import type {
  EvaluationResult,
  Finding,
  PairInputs,
  RuleId,
  RuleResult,
} from "../schema"

export type Scenario = {
  id: string
  rule: RuleId | "listing"
  description: string
  patientId: string
  donorId: string
  /** Pair inputs merged over defaultPairInputs() for scenarios that depend on them. */
  pair?: Partial<PairInputs>
  expect: (r: EvaluationResult) => boolean
}

const rule = (r: EvaluationResult, id: RuleId): RuleResult => {
  const found = r.rules.find((x) => x.rule === id)
  if (!found) throw new Error(`Rule ${id} missing from result`)
  return found
}
const status = (r: EvaluationResult, id: RuleId) => rule(r, id).status
const findings = (
  r: EvaluationResult,
  id: RuleId,
  code: string
): Array<Finding> =>
  rule(r, id).findings.filter(
    (f) => f.code === code || f.code.startsWith(`${code}.`)
  )
const has = (
  r: EvaluationResult,
  id: RuleId,
  code: string,
  s?: Finding["status"]
) => findings(r, id, code).some((f) => s === undefined || f.status === s)
const hasMissing = (r: EvaluationResult, id: RuleId, code: string) =>
  findings(r, id, code).some((f) => f.missing)
const blocked = (r: EvaluationResult, state: string) =>
  r.blockers.some(
    (b) => b.code === "blocker.patientState" && b.evidence === state
  )

const P = (n: number) => `demo-patient-${String(n).padStart(2, "0")}`
const D = (n: number) => `demo-donor-${String(n).padStart(2, "0")}`

/** Recorded pair logistics: 3 h 10 min static cold storage within 180 NM, negative crossmatches. */
const LOCAL: Partial<PairInputs> = {
  distanceNm: 180,
  procurementMinutes: 40,
  transportMinutes: 90,
  implantMinutes: 60,
  preservation: "static_cold",
  perfusionMinutes: null,
  flowCrossmatch: "negative",
  cdcCrossmatch: "negative",
}

export const SCENARIOS: ReadonlyArray<Scenario> = [
  /* ABO */
  {
    id: "abo.identical",
    rule: "abo",
    description: "O donor to O recipient passes as identical",
    patientId: P(1),
    donorId: D(1),
    expect: (r) =>
      status(r, "abo") === "pass" &&
      has(r, "abo", "abo.compatible", "pass") &&
      !has(r, "abo", "abo.priority"),
  },
  {
    id: "abo.compatible",
    rule: "abo",
    description: "O donor to A recipient passes with secondary priority",
    patientId: P(2),
    donorId: D(1),
    expect: (r) =>
      status(r, "abo") === "pass" && has(r, "abo", "abo.priority", "info"),
  },
  {
    id: "abo.incompatible",
    rule: "abo",
    description: "A donor to O adult recipient fails",
    patientId: P(8),
    donorId: D(5),
    expect: (r) =>
      status(r, "abo") === "fail" && has(r, "abo", "abo.incompatible", "fail"),
  },
  {
    id: "abo.pediatric-optin",
    rule: "abo",
    description:
      "Opted-in infant (B) offered an A heart needs specialist review",
    patientId: P(5),
    donorId: D(11),
    expect: (r) =>
      status(r, "abo") === "review" && has(r, "abo", "abo.infant", "review"),
  },
  {
    id: "abo.pediatric-optout",
    rule: "abo",
    description: "Child not consented for ABOi fails with an A donor",
    patientId: P(6),
    donorId: D(11),
    expect: (r) =>
      status(r, "abo") === "fail" && has(r, "abo", "abo.incompatible", "fail"),
  },
  {
    id: "abo.unknown",
    rule: "abo",
    description: "Recipient ABO not yet resulted is missing, never a pass",
    patientId: P(17),
    donorId: D(1),
    expect: (r) =>
      status(r, "abo") === "review" && hasMissing(r, "abo", "abo.missing"),
  },
  {
    id: "abo.a2",
    rule: "abo",
    description: "A2 donor to A recipient passes; subtype noted as information",
    patientId: P(7),
    donorId: D(5),
    expect: (r) =>
      status(r, "abo") === "pass" && has(r, "abo", "abo.subtypes", "info"),
  },

  /* Size */
  {
    id: "size.pass",
    rule: "size",
    description: "PHM ratio within the pass range",
    patientId: P(4),
    donorId: D(1),
    expect: (r) =>
      status(r, "size") === "pass" && has(r, "size", "size.phm", "pass"),
  },
  {
    id: "size.review",
    rule: "size",
    description: "Large male donor oversized for a petite female recipient",
    patientId: P(11),
    donorId: D(1),
    expect: (r) =>
      status(r, "size") === "review" && has(r, "size", "size.phm", "review"),
  },
  {
    id: "size.fail",
    rule: "size",
    description:
      "Small female donor badly undersized for a large male recipient",
    patientId: P(10),
    donorId: D(5),
    expect: (r) =>
      status(r, "size") === "fail" && has(r, "size", "size.phm", "fail"),
  },
  {
    id: "size.female-to-male",
    rule: "size",
    description: "Female donor to male recipient, PHM-matched",
    patientId: P(12),
    donorId: D(9),
    expect: (r) =>
      has(r, "size", "size.phm", "pass") &&
      findings(r, "size", "size.sex").some((f) =>
        f.detail.startsWith("Female donor to male")
      ),
  },
  {
    id: "size.pvr",
    rule: "size",
    description:
      "PVR above 4 WU with a donor smaller than the recipient needs review",
    patientId: P(9),
    donorId: D(5),
    expect: (r) => has(r, "size", "size.pvr", "review"),
  },
  {
    id: "size.pediatric",
    rule: "size",
    description: "Infant size decided by weight ratio",
    patientId: P(5),
    donorId: D(11),
    expect: (r) =>
      status(r, "size") === "pass" &&
      has(r, "size", "size.weight", "pass") &&
      has(r, "size", "size.phm", "info"),
  },
  {
    id: "size.missing-height",
    rule: "size",
    description:
      "Donor height not documented: PHM unavailable, weight ratio fallback used",
    patientId: P(4),
    donorId: D(12),
    expect: (r) =>
      !has(r, "size", "size.phm") &&
      findings(r, "size", "size.weight").some(
        (f) => f.title === "Weight fallback match"
      ),
  },

  /* Immunology */
  {
    id: "immunology.none",
    rule: "immunology",
    description: "Unsensitized recipient, no actionable antibody",
    patientId: P(4),
    donorId: D(1),
    expect: (r) =>
      status(r, "immunology") === "pass" &&
      has(r, "immunology", "immunology.screen", "pass"),
  },
  {
    id: "immunology.dsa",
    rule: "immunology",
    description: "A24 antibody at 8200 MFI against an A24 donor fails",
    patientId: P(3),
    donorId: D(4),
    expect: (r) =>
      status(r, "immunology") === "fail" &&
      has(r, "immunology", "immunology.dsa", "fail"),
  },
  {
    id: "immunology.high-cpra-no-dsa",
    rule: "immunology",
    description: "cPRA 82% but the donor carries none of the antibodies",
    patientId: P(3),
    donorId: D(1),
    expect: (r) =>
      status(r, "immunology") === "pass" &&
      r.rules
        .find((x) => x.rule === "immunology")!
        .findings.every((f) => !f.code.startsWith("immunology.dsa")),
  },
  {
    id: "immunology.missing-hla",
    rule: "immunology",
    description:
      "Sensitized recipient, donor typing pending: missing, never a pass",
    patientId: P(3),
    donorId: D(12),
    expect: (r) =>
      status(r, "immunology") === "review" &&
      hasMissing(r, "immunology", "immunology.donorTyping"),
  },
  {
    id: "immunology.flow-positive",
    rule: "immunology",
    description: "Positive flow crossmatch needs review",
    patientId: P(3),
    donorId: D(1),
    pair: { ...LOCAL, flowCrossmatch: "positive" },
    expect: (r) =>
      status(r, "immunology") === "review" &&
      has(r, "immunology", "immunology.crossmatch.flow", "review"),
  },
  {
    id: "immunology.cdc-positive",
    rule: "immunology",
    description: "Positive CDC crossmatch fails",
    patientId: P(3),
    donorId: D(1),
    pair: { ...LOCAL, flowCrossmatch: "positive", cdcCrossmatch: "positive" },
    expect: (r) =>
      status(r, "immunology") === "fail" &&
      has(r, "immunology", "immunology.crossmatch.cdc", "fail"),
  },

  /* Infection */
  {
    id: "infection.clean",
    rule: "infection",
    description: "All required donor tests negative",
    patientId: P(1),
    donorId: D(1),
    expect: (r) => status(r, "infection") === "pass",
  },
  {
    id: "infection.hcv-accepts",
    rule: "infection",
    description: "HCV-viremic donor, consented recipient: review",
    patientId: P(13),
    donorId: D(6),
    expect: (r) => has(r, "infection", "infection.hcvNat", "review"),
  },
  {
    id: "infection.hcv-declines",
    rule: "infection",
    description: "HCV-viremic donor, recipient declines: fail",
    patientId: P(8),
    donorId: D(6),
    expect: (r) =>
      status(r, "infection") === "fail" &&
      has(r, "infection", "infection.hcvNat", "fail"),
  },
  {
    id: "infection.hbv-core",
    rule: "infection",
    description: "Isolated anti-HBc, recipient accepts: review",
    patientId: P(14),
    donorId: D(2),
    expect: (r) => has(r, "infection", "infection.antiHbcOnly", "review"),
  },
  {
    id: "infection.cmv-mismatch",
    rule: "infection",
    description: "CMV D+/R- high-risk mismatch",
    patientId: P(15),
    donorId: D(3),
    expect: (r) =>
      status(r, "infection") === "review" &&
      has(r, "infection", "infection.cmvIgG.highRisk", "review"),
  },
  {
    id: "infection.phs",
    rule: "infection",
    description: "PHS increased-risk donor, recipient consented: review",
    patientId: P(13),
    donorId: D(6),
    expect: (r) => has(r, "infection", "infection.phs", "review"),
  },
  {
    id: "infection.missing",
    rule: "infection",
    description: "HCV NAT and Strongyloides pending: missing, never a pass",
    patientId: P(4),
    donorId: D(12),
    expect: (r) =>
      status(r, "infection") === "review" &&
      hasMissing(r, "infection", "infection.missing.hcvNat"),
  },

  /* Donor heart */
  {
    id: "donorHeart.normal",
    rule: "donorHeart",
    description: "Young donor with normal heart",
    patientId: P(1),
    donorId: D(1),
    expect: (r) => status(r, "donorHeart") === "pass",
  },
  {
    id: "donorHeart.older",
    rule: "donorHeart",
    description: "54-year-old donor needs review",
    patientId: P(14),
    donorId: D(2),
    expect: (r) =>
      has(r, "donorHeart", "donorHeart.age", "review") &&
      !has(r, "donorHeart", "donorHeart.angiographyIndicated"),
  },
  {
    id: "donorHeart.lvef-repeat",
    rule: "donorHeart",
    description: "Repeat echo LVEF 55% replaces initial 38%",
    patientId: P(15),
    donorId: D(3),
    expect: (r) =>
      has(r, "donorHeart", "donorHeart.repeatLvef", "info") &&
      has(r, "donorHeart", "donorHeart.lvef", "pass"),
  },
  {
    id: "donorHeart.inotropes",
    rule: "donorHeart",
    description: "Norepinephrine 0.18 plus dopamine 12 needs review",
    patientId: P(16),
    donorId: D(4),
    expect: (r) =>
      has(r, "donorHeart", "donorHeart.multipleVasoactives", "review") &&
      has(r, "donorHeart", "donorHeart.vasoactiveDose", "review"),
  },
  {
    id: "donorHeart.cad",
    rule: "donorHeart",
    description: "Single-vessel CAD on angiogram needs review",
    patientId: P(7),
    donorId: D(5),
    expect: (r) => has(r, "donorHeart", "donorHeart.coronaryDisease", "review"),
  },
  {
    id: "donorHeart.cocaine",
    rule: "donorHeart",
    description: "Cocaine use with 14 mm septum needs review",
    patientId: P(18),
    donorId: D(7),
    expect: (r) =>
      has(r, "donorHeart", "donorHeart.cocaineWallThickness", "review"),
  },
  {
    id: "donorHeart.co",
    rule: "donorHeart",
    description: "CO poisoning with COHb 44% and troponin 0.92 fails",
    patientId: P(19),
    donorId: D(8),
    expect: (r) =>
      status(r, "donorHeart") === "fail" &&
      has(r, "donorHeart", "donorHeart.coPoisoning", "fail"),
  },
  {
    id: "donorHeart.cpr",
    rule: "donorHeart",
    description: "38 min CPR with LVEF 46% needs review",
    patientId: P(20),
    donorId: D(9),
    expect: (r) => has(r, "donorHeart", "donorHeart.cprMinutes", "review"),
  },
  {
    id: "donorHeart.dcd",
    rule: "logistics",
    description: "DCD donor, fWIT 21 min, consented recipient",
    patientId: P(21),
    donorId: D(10),
    expect: (r) =>
      has(r, "logistics", "logistics.dcdFwit", "pass") &&
      !has(r, "logistics", "logistics.dcdAcceptance"),
  },

  /* Logistics */
  {
    id: "logistics.short",
    rule: "logistics",
    description: "3 h 10 min cold ischemia within distance limit passes",
    patientId: P(1),
    donorId: D(1),
    pair: LOCAL,
    expect: (r) =>
      status(r, "logistics") === "pass" &&
      has(r, "logistics", "logistics.ischemia", "pass") &&
      has(r, "logistics", "logistics.distance", "pass"),
  },
  {
    id: "logistics.long",
    rule: "logistics",
    description: "Long-distance static cold storage over 6 h fails",
    patientId: P(4),
    donorId: D(1),
    pair: { ...LOCAL, distanceNm: 480, transportMinutes: 300 },
    expect: (r) => has(r, "logistics", "logistics.ischemia", "fail"),
  },
  {
    id: "logistics.ocs",
    rule: "logistics",
    description: "OCS perfusion time is excluded from cold ischemia",
    patientId: P(21),
    donorId: D(10),
    pair: {
      ...LOCAL,
      distanceNm: 600,
      procurementMinutes: 45,
      transportMinutes: 240,
      implantMinutes: 60,
      preservation: "ocs_normothermic",
      perfusionMinutes: 300,
    },
    expect: (r) =>
      has(r, "logistics", "logistics.ischemia", "pass") &&
      has(r, "logistics", "logistics.perfusion", "info"),
  },
  {
    id: "logistics.redo",
    rule: "logistics",
    description:
      "Redo sternotomy and LVAD explant push the estimate into review",
    patientId: P(2),
    donorId: D(1),
    pair: LOCAL,
    expect: (r) => has(r, "logistics", "logistics.ischemia", "review"),
  },
  {
    id: "logistics.missing-distance",
    rule: "logistics",
    description: "Candidate has a distance limit but distance is not recorded",
    patientId: P(4),
    donorId: D(1),
    pair: { ...LOCAL, distanceNm: null },
    expect: (r) => hasMissing(r, "logistics", "logistics.distance"),
  },

  /* Listing */
  {
    id: "listing.inactive",
    rule: "listing",
    description: "Temporarily inactive candidate is blocked",
    patientId: P(22),
    donorId: D(1),
    expect: (r) => r.overall === "fail" && blocked(r, "inactive"),
  },
  {
    id: "listing.transplanted",
    rule: "listing",
    description: "Transplanted candidate is blocked",
    patientId: P(23),
    donorId: D(2),
    expect: (r) => r.overall === "fail" && blocked(r, "transplanted"),
  },
  {
    id: "listing.removed",
    rule: "listing",
    description: "Removed candidate is blocked",
    patientId: P(24),
    donorId: D(4),
    expect: (r) => r.overall === "fail" && blocked(r, "removed"),
  },
  {
    id: "listing.evaluation",
    rule: "listing",
    description: "Candidate still under evaluation is blocked",
    patientId: P(17),
    donorId: D(1),
    expect: (r) => r.overall === "fail" && blocked(r, "evaluation"),
  },
]
