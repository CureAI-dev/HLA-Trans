import type { Criteria, Outcome } from "./schema"

/**
 * Demo default criteria. Every value cites its origin. Where guidelines give
 * no number (MFI cut-offs, troponin), the default is labelled as center
 * practice and must be set by the transplant program.
 */
export const DEFAULT_CRITERIA: Criteria = {
  abo: {
    allowPediatricIncompatible: true,
    maxTiterOneYearPlus: 16,
  },
  size: {
    phmRatioPassMin: 0.86,
    phmRatioReviewMin: 0.7,
    phmRatioReviewMax: 1.3,
    weightRatioPassMin: 0.8,
    weightRatioReviewMin: 0.7,
    femaleToMaleWeightRatioMin: 0.8,
    pulmonaryHypertensionPvr: 4,
    phmRatioMinWithPulmonaryHypertension: 1.0,
    pediatricWeightRatioMin: 0.6,
    pediatricWeightRatioMax: 3.0,
  },
  immunology: {
    mfiReviewMin: 2000,
    mfiFailMin: 5000,
    c1qPositiveOutcome: "fail",
    unacceptableAntigenOutcome: "fail",
    cpraSensitizedMin: 10,
    flowCrossmatchPositiveOutcome: "review",
    cdcCrossmatchPositiveOutcome: "fail",
  },
  infection: {
    hivDonorOutcome: "fail",
    hcvNatOutcome: "review",
    hcvAbOnlyOutcome: "review",
    hbsAgOrHbvNatOutcome: "review",
    antiHbcOnlyOutcome: "review",
    cmvHighRiskOutcome: "review",
    ebvHighRiskOutcome: "review",
    toxoHighRiskOutcome: "review",
    chagasOutcome: "fail",
    strongyloidesOutcome: "review",
    syphilisOutcome: "review",
    wnvOutcome: "fail",
    bacteremiaOutcome: "review",
    phsRiskOutcome: "review",
  },
  donor: {
    ageReviewAbove: 45,
    ageFailAbove: null,
    lvefPassMin: 50,
    lvefReviewMin: 40,
    wallThicknessPassMax: 13,
    wallThicknessReviewMax: 16,
    sodiumFailBelow: 129,
    sodiumFailAtOrAbove: 170,
    sodiumReviewBelow: 135,
    sodiumReviewAbove: 155,
    norepinephrineMaxAlone: 0.1,
    dopamineReviewAbove: 10,
    vasoactiveAgentsReviewMin: 2,
    troponinIReviewAbove: 1.0,
    cprMinutesReview: 30,
    angioAgeMale: 40,
    angioAgeFemale: 45,
    multivesselCadOutcome: "fail",
    singleVesselCadOutcome: "review",
    moderateValveOutcome: "fail",
    coHbFailAbove: 40,
    coTroponinFailAtOrAbove: 0.7,
  },
  logistics: {
    ischemicPassMaxMinutes: 240,
    ischemicReviewMaxMinutes: 360,
    olderDonorAge: 45,
    dcdFwitPassMaxMinutes: 30,
    dcdFwitReviewMaxMinutes: 45,
    redoSternotomyExtraMinutes: 45,
    deviceExplantExtraMinutes: 60,
  },
}

/* ------------------------------------------------------------------ */
/* Descriptors for the settings editor                                 */
/* ------------------------------------------------------------------ */

type Section = keyof Criteria

type NumberField = {
  kind: "number"
  section: Section
  key: string
  label: string
  unit?: string
  step: number
  nullable?: boolean
  source: string
}
type OutcomeField = {
  kind: "outcome"
  section: Section
  key: string
  label: string
  source: string
}
type BooleanField = {
  kind: "boolean"
  section: Section
  key: string
  label: string
  source: string
}
export type CriteriaField = NumberField | OutcomeField | BooleanField

export const CRITERIA_SECTIONS: ReadonlyArray<{ id: Section; title: string; description: string }> = [
  { id: "abo", title: "Blood type", description: "ABO compatibility and the pediatric ABO-incompatible pathway." },
  { id: "size", title: "Size match", description: "Predicted heart mass and weight ratios, with pulmonary hypertension adjustment." },
  { id: "immunology", title: "HLA and antibodies", description: "Virtual crossmatch against antibodies and unacceptable antigens, plus physical crossmatch." },
  { id: "infection", title: "Infection", description: "What each donor infection finding means for this pair." },
  { id: "donor", title: "Donor heart", description: "Donor age, heart function, structure, coronaries, labs and support." },
  { id: "logistics", title: "Ischemic time", description: "Estimated ischemic time and DCD warm ischemia." },
]

const COPELAND = "ISHLT donor heart selection guideline (Copeland 2023)"
const CENTER = "Center practice, no consensus value: set locally"

export const CRITERIA_FIELDS: ReadonlyArray<CriteriaField> = [
  { kind: "boolean", section: "abo", key: "allowPediatricIncompatible", label: "Allow pediatric intended ABO-incompatible offers", source: "OPTN Policy 6.6.B" },
  { kind: "number", section: "abo", key: "maxTiterOneYearPlus", label: "Maximum isohemagglutinin titer, candidates 1 year or older (1:x)", step: 1, source: "OPTN 6.6.B.i (1:16)" },

  { kind: "number", section: "size", key: "phmRatioPassMin", label: "PHM ratio: pass at or above", step: 0.01, source: "Kransdorf, JHLT 2019 (0.86)" },
  { kind: "number", section: "size", key: "phmRatioReviewMin", label: "PHM ratio: review at or above (fail below)", step: 0.01, source: `Center practice. ${COPELAND} Table 12: lower survival with PHM difference >10–15%` },
  { kind: "number", section: "size", key: "phmRatioReviewMax", label: "PHM ratio: review above (oversized)", step: 0.01, source: "Center practice (1.30). Tao, JAMA Netw Open 2023: no extra mortality with overmatch above 1.14" },
  { kind: "number", section: "size", key: "weightRatioPassMin", label: "Weight ratio fallback: pass at or above", step: 0.01, source: "ISHLT 2010 (Costanzo)" },
  { kind: "number", section: "size", key: "weightRatioReviewMin", label: "Weight ratio fallback: review at or above (fail below)", step: 0.01, source: "ISHLT 2010: donor no more than 30% lighter" },
  { kind: "number", section: "size", key: "femaleToMaleWeightRatioMin", label: "Female donor to male recipient: minimum weight ratio", step: 0.01, source: "ISHLT 2010: female donor >20% lighter than male recipient viewed with caution" },
  { kind: "number", section: "size", key: "pulmonaryHypertensionPvr", label: "Recipient PVR that tightens size limits", unit: "WU", step: 0.1, source: "Patel, Circulation 2008: undersized hearts did worse when PVR >4 WU" },
  { kind: "number", section: "size", key: "phmRatioMinWithPulmonaryHypertension", label: "PHM ratio needed when PVR is above that value", step: 0.01, source: "Tao, JAMA Netw Open 2023: with PVR >5 WU, lower risk when PHM match is near 100% or above" },
  { kind: "number", section: "size", key: "pediatricWeightRatioMin", label: "Pediatric weight ratio: minimum", step: 0.05, source: "ISHLT pediatric consensus (Kirk 2020): 0.6" },
  { kind: "number", section: "size", key: "pediatricWeightRatioMax", label: "Pediatric weight ratio: maximum", step: 0.05, source: "ISHLT pediatric consensus (Kirk 2020): 3.0" },

  { kind: "number", section: "immunology", key: "mfiReviewMin", label: "DSA MFI: review at or above", unit: "MFI", step: 100, source: CENTER },
  { kind: "number", section: "immunology", key: "mfiFailMin", label: "DSA MFI: fail at or above", unit: "MFI", step: 100, source: `${CENTER}. Published heart example: avoid >5000` },
  { kind: "outcome", section: "immunology", key: "c1qPositiveOutcome", label: "Complement-binding (C1q+) DSA", source: "Complement-binding DSA carry strong negative prognosis" },
  { kind: "outcome", section: "immunology", key: "unacceptableAntigenOutcome", label: "Donor carries a listed unacceptable antigen", source: "OPTN 4.11.B equivalences; CPRA definition OPTN 1.2" },
  { kind: "number", section: "immunology", key: "cpraSensitizedMin", label: "cPRA considered sensitized above", unit: "%", step: 1, source: "ISHLT 2018 (PRA >10%); AHA 2019: no cPRA threshold set, many centers use 50%" },
  { kind: "outcome", section: "immunology", key: "flowCrossmatchPositiveOutcome", label: "Positive flow crossmatch", source: "FCXM+/CDC−: lower burden, mitigation possible" },
  { kind: "outcome", section: "immunology", key: "cdcCrossmatchPositiveOutcome", label: "Positive CDC crossmatch", source: "Both positive: transplant usually contraindicated" },

  { kind: "outcome", section: "infection", key: "hivDonorOutcome", label: "Donor HIV positive", source: "OPTN 15.7: HIV+ recipients under IRB protocol only" },
  { kind: "outcome", section: "infection", key: "hcvNatOutcome", label: "Donor HCV NAT positive (viremic)", source: "ISHLT cardiothoracic HCV consensus (Aslam 2020): acceptable with DAA + consent" },
  { kind: "outcome", section: "infection", key: "hcvAbOnlyOutcome", label: "Donor anti-HCV positive, NAT negative", source: "Acceptable with NAT surveillance" },
  { kind: "outcome", section: "infection", key: "hbsAgOrHbvNatOutcome", label: "Donor HBsAg or HBV NAT positive", source: "AST HBV donor consensus (Huprikar 2015): prophylaxis + consent" },
  { kind: "outcome", section: "infection", key: "antiHbcOnlyOutcome", label: "Donor anti-HBc positive only", source: "Non-liver transmission rare (about 0.02%, US 2016–2021); surveillance" },
  { kind: "outcome", section: "infection", key: "cmvHighRiskOutcome", label: "CMV donor+/recipient−", source: "CMV consensus 2025: high risk, 3–6 mo prophylaxis" },
  { kind: "outcome", section: "infection", key: "ebvHighRiskOutcome", label: "EBV donor+/recipient−", source: "AST IDCOP 2019: PTLD risk, viral load surveillance" },
  { kind: "outcome", section: "infection", key: "toxoHighRiskOutcome", label: "Toxoplasma donor+/recipient−", source: "Heart D+/R−: 50–75% transmission without TMP-SMX prophylaxis" },
  { kind: "outcome", section: "infection", key: "chagasOutcome", label: "Donor T. cruzi (Chagas) positive", source: "Chagas working group 2011: against heart use" },
  { kind: "outcome", section: "infection", key: "strongyloidesOutcome", label: "Donor Strongyloides positive", source: "AST IDCOP 2019: treat recipient (ivermectin)" },
  { kind: "outcome", section: "infection", key: "syphilisOutcome", label: "Donor syphilis positive", source: CENTER },
  { kind: "outcome", section: "infection", key: "wnvOutcome", label: "Donor West Nile virus positive", source: `${COPELAND}: active WNV, do not use` },
  { kind: "outcome", section: "infection", key: "bacteremiaOutcome", label: "Donor positive blood culture", source: `${COPELAND}: acceptable with targeted antibiotics` },
  { kind: "outcome", section: "infection", key: "phsRiskOutcome", label: "Donor meets PHS risk criteria", source: "PHS 2020 guideline: disclosure required" },

  { kind: "number", section: "donor", key: "ageReviewAbove", label: "Donor age: review at or above", unit: "years", step: 1, source: `${COPELAND}: <45 recommended; ≥45 needs coronary screening` },
  { kind: "number", section: "donor", key: "ageFailAbove", label: "Donor age: fail above (blank = no limit)", unit: "years", step: 1, nullable: true, source: `${COPELAND}: no upper age limit` },
  { kind: "number", section: "donor", key: "lvefPassMin", label: "LVEF: pass at or above", unit: "%", step: 1, source: `${CENTER}. ${COPELAND}: LVEF <45% needs stress or repeat echo` },
  { kind: "number", section: "donor", key: "lvefReviewMin", label: "LVEF: review at or above (fail below)", unit: "%", step: 1, source: `${CENTER}. ${COPELAND}: pursue low-LVEF hearts from young donors` },
  { kind: "number", section: "donor", key: "wallThicknessPassMax", label: "LV wall thickness: pass at or below", unit: "mm", step: 1, source: `${COPELAND}: mild LVH 11–13 mm` },
  { kind: "number", section: "donor", key: "wallThicknessReviewMax", label: "LV wall thickness: review at or below (fail above)", unit: "mm", step: 1, source: `${COPELAND}: moderate 14–16, severe ≥17 mm` },
  { kind: "number", section: "donor", key: "sodiumFailBelow", label: "Sodium: fail below", unit: "mmol/L", step: 1, source: `${COPELAND}: avoid <129` },
  { kind: "number", section: "donor", key: "sodiumFailAtOrAbove", label: "Sodium: fail at or above", unit: "mmol/L", step: 1, source: `${COPELAND}: avoid ≥170` },
  { kind: "number", section: "donor", key: "sodiumReviewBelow", label: "Sodium: review below", unit: "mmol/L", step: 1, source: "Normal range 135–145" },
  { kind: "number", section: "donor", key: "sodiumReviewAbove", label: "Sodium: review above", unit: "mmol/L", step: 1, source: "Donor management target 140–155" },
  { kind: "number", section: "donor", key: "norepinephrineMaxAlone", label: "Norepinephrine alone: acceptable up to", unit: "mcg/kg/min", step: 0.01, source: `${COPELAND}: ≤0.1 alone (Class I)` },
  { kind: "number", section: "donor", key: "dopamineReviewAbove", label: "Dopamine: review above", unit: "mcg/kg/min", step: 1, source: "Donor management review (<10)" },
  { kind: "number", section: "donor", key: "vasoactiveAgentsReviewMin", label: "Number of vasoactive agents that triggers review", step: 1, source: CENTER },
  { kind: "number", section: "donor", key: "troponinIReviewAbove", label: "Peak troponin I: review above", unit: "ng/mL", step: 0.1, source: `${CENTER}. ${COPELAND}: not a reason to decline alone` },
  { kind: "number", section: "donor", key: "cprMinutesReview", label: "CPR duration that needs LVEF ≥50% to pass", unit: "min", step: 1, source: `${COPELAND}: >30 min fine if LVEF >50%` },
  { kind: "number", section: "donor", key: "angioAgeMale", label: "Angiography expected: male donors older than", unit: "years", step: 1, source: "UNOS 2018 (>40)" },
  { kind: "number", section: "donor", key: "angioAgeFemale", label: "Angiography expected: female donors older than", unit: "years", step: 1, source: "UNOS 2018 (>45)" },
  { kind: "outcome", section: "donor", key: "multivesselCadOutcome", label: "Left main or 2–3 vessel disease ≥50%", source: `${COPELAND}: avoid (IIb)` },
  { kind: "outcome", section: "donor", key: "singleVesselCadOutcome", label: "Single-vessel disease ≥50%", source: `${COPELAND}: may consider (IIb)` },
  { kind: "outcome", section: "donor", key: "moderateValveOutcome", label: "Moderate or severe valve disease", source: `${CENTER}. Not a ${COPELAND} recommendation` },
  { kind: "number", section: "donor", key: "coHbFailAbove", label: "CO poisoning: carboxyhemoglobin fail above", unit: "%", step: 1, source: `${COPELAND}: avoid if COHb >40%` },
  { kind: "number", section: "donor", key: "coTroponinFailAtOrAbove", label: "CO poisoning: troponin fail at or above", unit: "ng/mL", step: 0.1, source: `${COPELAND}: avoid if troponin ≥0.7` },

  { kind: "number", section: "logistics", key: "ischemicPassMaxMinutes", label: "Ischemic time: pass up to", unit: "min", step: 5, source: `${COPELAND}: target ≤4 h` },
  { kind: "number", section: "logistics", key: "ischemicReviewMaxMinutes", label: "Ischemic time: review up to (fail above)", unit: "min", step: 5, source: "Center practice; >6 h only with machine perfusion" },
  { kind: "number", section: "logistics", key: "olderDonorAge", label: "Donor age at or above which >4 h is avoided", unit: "years", step: 1, source: `${COPELAND}: ≥45 only with ischemic time <4 h` },
  { kind: "number", section: "logistics", key: "dcdFwitPassMaxMinutes", label: "DCD functional warm ischemia: pass up to", unit: "min", step: 1, source: "OCS DCD Heart Trial (≤30 min)" },
  { kind: "number", section: "logistics", key: "dcdFwitReviewMaxMinutes", label: "DCD functional warm ischemia: review up to", unit: "min", step: 1, source: `${CENTER}. No published tolerance limit beyond the 30 min trial limit` },
  { kind: "number", section: "logistics", key: "redoSternotomyExtraMinutes", label: "Extra implant time for redo sternotomy", unit: "min", step: 5, source: CENTER },
  { kind: "number", section: "logistics", key: "deviceExplantExtraMinutes", label: "Extra implant time for VAD/TAH explant", unit: "min", step: 5, source: CENTER },
]

export const OUTCOME_LABEL: Record<Outcome, string> = {
  pass: "Pass",
  review: "Needs review",
  fail: "Fail",
}

/* ------------------------------------------------------------------ */
/* Cross-field validation                                              */
/* ------------------------------------------------------------------ */

export type CriteriaIssue = { path: string; message: string }

/** Ordering rules zod cannot express. Empty array = valid. */
export function validateCriteria(c: Criteria): Array<CriteriaIssue> {
  const issues: Array<CriteriaIssue> = []
  const need = (cond: boolean, path: string, message: string) => {
    if (!cond) issues.push({ path, message })
  }
  need(c.size.phmRatioReviewMin <= c.size.phmRatioPassMin, "size.phmRatioReviewMin", "PHM review minimum must be at or below the pass minimum.")
  need(c.size.phmRatioPassMin < c.size.phmRatioReviewMax, "size.phmRatioReviewMax", "PHM oversize limit must be above the pass minimum.")
  need(c.size.weightRatioReviewMin <= c.size.weightRatioPassMin, "size.weightRatioReviewMin", "Weight review minimum must be at or below the pass minimum.")
  need(c.size.pediatricWeightRatioMin < c.size.pediatricWeightRatioMax, "size.pediatricWeightRatioMax", "Pediatric maximum must be above the minimum.")
  need(c.immunology.mfiReviewMin <= c.immunology.mfiFailMin, "immunology.mfiFailMin", "MFI fail level must be at or above the review level.")
  need(c.donor.lvefReviewMin <= c.donor.lvefPassMin, "donor.lvefReviewMin", "LVEF review minimum must be at or below the pass minimum.")
  need(c.donor.wallThicknessPassMax <= c.donor.wallThicknessReviewMax, "donor.wallThicknessReviewMax", "Wall thickness review limit must be at or above the pass limit.")
  need(c.donor.sodiumFailBelow <= c.donor.sodiumReviewBelow, "donor.sodiumReviewBelow", "Sodium review-low must be at or above fail-low.")
  need(c.donor.sodiumReviewBelow < c.donor.sodiumReviewAbove, "donor.sodiumReviewAbove", "Sodium review-high must be above review-low.")
  need(c.donor.sodiumReviewAbove < c.donor.sodiumFailAtOrAbove, "donor.sodiumFailAtOrAbove", "Sodium fail-high must be above review-high.")
  need(c.donor.ageFailAbove === null || c.donor.ageFailAbove >= c.donor.ageReviewAbove, "donor.ageFailAbove", "Age fail limit must be at or above the review limit.")
  need(c.logistics.ischemicPassMaxMinutes <= c.logistics.ischemicReviewMaxMinutes, "logistics.ischemicReviewMaxMinutes", "Ischemic review limit must be at or above the pass limit.")
  need(c.logistics.dcdFwitPassMaxMinutes <= c.logistics.dcdFwitReviewMaxMinutes, "logistics.dcdFwitReviewMaxMinutes", "DCD warm ischemia review limit must be at or above the pass limit.")
  return issues
}
