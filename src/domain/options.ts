/**
 * Controlled vocabularies. Codes follow OPTN / SRTR data dictionary value
 * sets where one exists (TCR heart diagnosis codes, DDR cause/mechanism/
 * circumstance of death) so records can later be mapped to registry data.
 */

export type Option<T extends string = string> = {
  readonly value: T
  readonly label: string
  readonly group?: string
  readonly hint?: string
}

const values = <T extends string>(options: ReadonlyArray<Option<T>>) =>
  options.map((o) => o.value) as [T, ...Array<T>]

export const labelOf = <T extends string>(
  options: ReadonlyArray<Option<T>>,
  value: T | null | undefined
): string => {
  if (value === null || value === undefined) return "Not recorded"
  return options.find((o) => o.value === value)?.label ?? value
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const TRI = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type Tri = (typeof TRI)[number]["value"]
export const TRI_VALUES = values(TRI)

export const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies ReadonlyArray<Option>
export type Sex = (typeof SEX)[number]["value"]
export const SEX_VALUES = values(SEX)

export const ABO = [
  { value: "O", label: "O" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "AB", label: "AB" },
] as const satisfies ReadonlyArray<Option>
export type Abo = (typeof ABO)[number]["value"]
export const ABO_VALUES = values(ABO)

export const ABO_SUBTYPE = [
  { value: "none", label: "Not subtyped" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "A1B", label: "A1B" },
  { value: "A2B", label: "A2B" },
] as const satisfies ReadonlyArray<Option>
export type AboSubtype = (typeof ABO_SUBTYPE)[number]["value"]
export const ABO_SUBTYPE_VALUES = values(ABO_SUBTYPE)

/** OPTN ETHCAT categories. */
export const ETHNICITY = [
  { value: "white", label: "White" },
  { value: "black", label: "Black or African American" },
  { value: "hispanic", label: "Hispanic or Latino" },
  { value: "asian", label: "Asian" },
  { value: "aian", label: "American Indian or Alaska Native" },
  { value: "nhpi", label: "Native Hawaiian or Pacific Islander" },
  { value: "multiracial", label: "Multiracial" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type Ethnicity = (typeof ETHNICITY)[number]["value"]
export const ETHNICITY_VALUES = values(ETHNICITY)

/** Serology / NAT result. */
export const SEROLOGY = [
  { value: "negative", label: "Negative" },
  { value: "positive", label: "Positive" },
  { value: "indeterminate", label: "Indeterminate" },
  { value: "not_done", label: "Not done" },
] as const satisfies ReadonlyArray<Option>
export type Serology = (typeof SEROLOGY)[number]["value"]
export const SEROLOGY_VALUES = values(SEROLOGY)

/* ------------------------------------------------------------------ */
/* Recipient                                                           */
/* ------------------------------------------------------------------ */

export const CANDIDATE_STATE = [
  { value: "active", label: "Active on waitlist" },
  { value: "inactive", label: "Temporarily inactive" },
  { value: "evaluation", label: "Under evaluation" },
  { value: "transplanted", label: "Transplanted" },
  { value: "removed", label: "Removed from list" },
] as const satisfies ReadonlyArray<Option>
export type CandidateState = (typeof CANDIDATE_STATE)[number]["value"]
export const CANDIDATE_STATE_VALUES = values(CANDIDATE_STATE)

/** OPTN heart urgency status (adult Oct-2018 policy, pediatric 1A/1B/2). */
export const URGENCY_STATUS = [
  { value: "A1", label: "Adult status 1", group: "Adult" },
  { value: "A2", label: "Adult status 2", group: "Adult" },
  { value: "A3", label: "Adult status 3", group: "Adult" },
  { value: "A4", label: "Adult status 4", group: "Adult" },
  { value: "A5", label: "Adult status 5 (multi-organ)", group: "Adult" },
  { value: "A6", label: "Adult status 6", group: "Adult" },
  { value: "P1A", label: "Pediatric status 1A", group: "Pediatric" },
  { value: "P1B", label: "Pediatric status 1B", group: "Pediatric" },
  { value: "P2", label: "Pediatric status 2", group: "Pediatric" },
] as const satisfies ReadonlyArray<Option>
export type UrgencyStatus = (typeof URGENCY_STATUS)[number]["value"]
export const URGENCY_STATUS_VALUES = values(URGENCY_STATUS)

/** Rank used to order candidates (lower = more urgent). */
export const URGENCY_RANK: Record<UrgencyStatus, number> = {
  A1: 1,
  P1A: 1,
  A2: 2,
  A3: 3,
  P1B: 3,
  A4: 4,
  A5: 5,
  A6: 6,
  P2: 6,
}

/** OPTN TCR thoracic diagnosis codes, heart subset. */
export const HEART_DIAGNOSIS = [
  { value: "1000", label: "Dilated: idiopathic", group: "Dilated cardiomyopathy" },
  { value: "1001", label: "Dilated: adriamycin", group: "Dilated cardiomyopathy" },
  { value: "1002", label: "Dilated: post partum", group: "Dilated cardiomyopathy" },
  { value: "1003", label: "Dilated: familial", group: "Dilated cardiomyopathy" },
  { value: "1004", label: "Dilated: myocarditis", group: "Dilated cardiomyopathy" },
  { value: "1005", label: "Dilated: alcoholic", group: "Dilated cardiomyopathy" },
  { value: "1006", label: "Dilated: viral", group: "Dilated cardiomyopathy" },
  { value: "1007", label: "Dilated: ischemic", group: "Dilated cardiomyopathy" },
  { value: "1049", label: "Dilated: other", group: "Dilated cardiomyopathy" },
  { value: "1050", label: "Restrictive: idiopathic", group: "Restrictive cardiomyopathy" },
  { value: "1051", label: "Restrictive: amyloidosis", group: "Restrictive cardiomyopathy" },
  { value: "1052", label: "Restrictive: endocardial fibrosis", group: "Restrictive cardiomyopathy" },
  { value: "1053", label: "Restrictive: sarcoidosis", group: "Restrictive cardiomyopathy" },
  { value: "1054", label: "Restrictive: post radiation/chemo", group: "Restrictive cardiomyopathy" },
  { value: "1099", label: "Restrictive: other", group: "Restrictive cardiomyopathy" },
  { value: "1100", label: "Re-transplant: hyperacute rejection", group: "Re-transplant / graft failure" },
  { value: "1101", label: "Re-transplant: acute rejection", group: "Re-transplant / graft failure" },
  { value: "1102", label: "Re-transplant: coronary artery disease", group: "Re-transplant / graft failure" },
  { value: "1103", label: "Re-transplant: non-specific", group: "Re-transplant / graft failure" },
  { value: "1104", label: "Re-transplant: restrictive/constrictive", group: "Re-transplant / graft failure" },
  { value: "1105", label: "Re-transplant: chronic rejection", group: "Re-transplant / graft failure" },
  { value: "1106", label: "Re-transplant: primary failure", group: "Re-transplant / graft failure" },
  { value: "1199", label: "Re-transplant: other", group: "Re-transplant / graft failure" },
  { value: "1200", label: "Coronary artery disease", group: "Other cardiac" },
  { value: "1201", label: "Hypertrophic cardiomyopathy", group: "Other cardiac" },
  { value: "1202", label: "Valvular heart disease", group: "Other cardiac" },
  { value: "1204", label: "Cancer", group: "Other cardiac" },
  { value: "1208", label: "Arrhythmogenic RV dysplasia/cardiomyopathy", group: "Other cardiac" },
  { value: "1209", label: "Muscular dystrophy", group: "Other cardiac" },
  { value: "1497", label: "Cardiac disease, other", group: "Other cardiac" },
  { value: "1203", label: "Congenital: prior surgery unknown", group: "Congenital heart disease" },
  { value: "1205", label: "Congenital: hypoplastic left heart syndrome", group: "Congenital heart disease" },
  { value: "1206", label: "Congenital: without surgery", group: "Congenital heart disease" },
  { value: "1207", label: "Congenital: with surgery", group: "Congenital heart disease" },
] as const satisfies ReadonlyArray<Option>
export type HeartDiagnosis = (typeof HEART_DIAGNOSIS)[number]["value"]
export const HEART_DIAGNOSIS_VALUES = values(HEART_DIAGNOSIS)

export const MCS_DEVICE = [
  { value: "none", label: "None" },
  { value: "iabp", label: "Intra-aortic balloon pump" },
  { value: "percutaneous", label: "Percutaneous endovascular MCSD (e.g. Impella)" },
  { value: "va_ecmo", label: "VA-ECMO" },
  { value: "lvad_durable", label: "Durable LVAD (dischargeable)" },
  { value: "lvad_nondischargeable", label: "Surgical LVAD (non-dischargeable)" },
  { value: "bivad", label: "BiVAD" },
  { value: "rvad", label: "RVAD alone" },
  { value: "tah", label: "Total artificial heart" },
] as const satisfies ReadonlyArray<Option>
export type McsDevice = (typeof MCS_DEVICE)[number]["value"]
export const MCS_DEVICE_VALUES = values(MCS_DEVICE)

/** Surgically implanted devices that will need explant at transplant. */
export const MCS_REQUIRES_EXPLANT: ReadonlyArray<McsDevice> = [
  "lvad_durable",
  "lvad_nondischargeable",
  "bivad",
  "rvad",
  "tah",
]

export const INOTROPE_AGENT = [
  { value: "dobutamine", label: "Dobutamine" },
  { value: "milrinone", label: "Milrinone" },
  { value: "dopamine", label: "Dopamine" },
  { value: "epinephrine", label: "Epinephrine" },
  { value: "norepinephrine", label: "Norepinephrine" },
  { value: "phenylephrine", label: "Phenylephrine" },
  { value: "vasopressin", label: "Vasopressin" },
] as const satisfies ReadonlyArray<Option>
export type InotropeAgent = (typeof INOTROPE_AGENT)[number]["value"]
export const INOTROPE_AGENT_VALUES = values(INOTROPE_AGENT)

/** Dose unit per agent. Vasopressin is weight-independent. */
export const INOTROPE_UNIT: Record<InotropeAgent, string> = {
  dobutamine: "mcg/kg/min",
  milrinone: "mcg/kg/min",
  dopamine: "mcg/kg/min",
  epinephrine: "mcg/kg/min",
  norepinephrine: "mcg/kg/min",
  phenylephrine: "mcg/kg/min",
  vasopressin: "units/h",
}

export const NYHA = [
  { value: "I", label: "Class I" },
  { value: "II", label: "Class II" },
  { value: "III", label: "Class III" },
  { value: "IV", label: "Class IV" },
] as const satisfies ReadonlyArray<Option>
export type Nyha = (typeof NYHA)[number]["value"]
export const NYHA_VALUES = values(NYHA)

export const DIALYSIS = [
  { value: "none", label: "None" },
  { value: "hemodialysis", label: "Hemodialysis" },
  { value: "peritoneal", label: "Peritoneal dialysis" },
  { value: "crrt", label: "CRRT" },
] as const satisfies ReadonlyArray<Option>
export type Dialysis = (typeof DIALYSIS)[number]["value"]
export const DIALYSIS_VALUES = values(DIALYSIS)

export const DIABETES = [
  { value: "none", label: "None" },
  { value: "type1", label: "Type 1" },
  { value: "type2", label: "Type 2" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type Diabetes = (typeof DIABETES)[number]["value"]
export const DIABETES_VALUES = values(DIABETES)

export const SMOKING = [
  { value: "never", label: "Never" },
  { value: "former", label: "Former" },
  { value: "current", label: "Current" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type Smoking = (typeof SMOKING)[number]["value"]
export const SMOKING_VALUES = values(SMOKING)

export const TRANSFUSION_BAND = [
  { value: "none", label: "None" },
  { value: "1-5", label: "1–5 units" },
  { value: "6-10", label: "6–10 units" },
  { value: ">10", label: "More than 10 units" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type TransfusionBand = (typeof TRANSFUSION_BAND)[number]["value"]
export const TRANSFUSION_BAND_VALUES = values(TRANSFUSION_BAND)

export const C1Q = [
  { value: "not_done", label: "Not done" },
  { value: "negative", label: "Negative" },
  { value: "positive", label: "Positive" },
] as const satisfies ReadonlyArray<Option>
export type C1q = (typeof C1Q)[number]["value"]
export const C1Q_VALUES = values(C1Q)

/* ------------------------------------------------------------------ */
/* Donor                                                               */
/* ------------------------------------------------------------------ */

export const DONOR_STATE = [
  { value: "available", label: "Available" },
  { value: "allocated", label: "Allocated" },
  { value: "declined", label: "Declined by all" },
  { value: "closed", label: "Closed" },
] as const satisfies ReadonlyArray<Option>
export type DonorState = (typeof DONOR_STATE)[number]["value"]
export const DONOR_STATE_VALUES = values(DONOR_STATE)

export const DONATION_TYPE = [
  { value: "dbd", label: "Donation after brain death (DBD)" },
  { value: "dcd", label: "Donation after circulatory death (DCD)" },
] as const satisfies ReadonlyArray<Option>
export type DonationType = (typeof DONATION_TYPE)[number]["value"]
export const DONATION_TYPE_VALUES = values(DONATION_TYPE)

export const DCD_RECOVERY = [
  { value: "dpp", label: "Direct procurement + normothermic ex situ perfusion" },
  { value: "ta_nrp", label: "Thoraco-abdominal normothermic regional perfusion" },
  { value: "dp_hope", label: "Direct procurement + hypothermic oxygenated perfusion" },
] as const satisfies ReadonlyArray<Option>
export type DcdRecovery = (typeof DCD_RECOVERY)[number]["value"]
export const DCD_RECOVERY_VALUES = values(DCD_RECOVERY)

/** OPTN DDR cause of death (DONCOD). */
export const CAUSE_OF_DEATH = [
  { value: "1", label: "Anoxia" },
  { value: "2", label: "Cerebrovascular / stroke" },
  { value: "3", label: "Head trauma" },
  { value: "4", label: "CNS tumor" },
  { value: "999", label: "Other" },
  { value: "998", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type CauseOfDeath = (typeof CAUSE_OF_DEATH)[number]["value"]
export const CAUSE_OF_DEATH_VALUES = values(CAUSE_OF_DEATH)

/** OPTN DDR mechanism of death (DTHMCH). */
export const MECHANISM_OF_DEATH = [
  { value: "1", label: "Drowning" },
  { value: "2", label: "Seizure" },
  { value: "3", label: "Drug intoxication" },
  { value: "4", label: "Asphyxiation" },
  { value: "5", label: "Cardiovascular" },
  { value: "6", label: "Electrical" },
  { value: "7", label: "Gunshot wound" },
  { value: "8", label: "Stab" },
  { value: "9", label: "Blunt injury" },
  { value: "10", label: "SIDS" },
  { value: "11", label: "Intracranial hemorrhage / stroke" },
  { value: "12", label: "Death from natural causes" },
  { value: "997", label: "None of the above" },
  { value: "998", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type MechanismOfDeath = (typeof MECHANISM_OF_DEATH)[number]["value"]
export const MECHANISM_OF_DEATH_VALUES = values(MECHANISM_OF_DEATH)

/** OPTN DDR circumstance of death (DTHCRCM). */
export const CIRCUMSTANCE_OF_DEATH = [
  { value: "1", label: "Motor vehicle accident" },
  { value: "2", label: "Suicide" },
  { value: "3", label: "Homicide" },
  { value: "4", label: "Child abuse" },
  { value: "5", label: "Accident, non-MVA" },
  { value: "6", label: "Death from natural causes" },
  { value: "997", label: "None of the above" },
  { value: "998", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type CircumstanceOfDeath = (typeof CIRCUMSTANCE_OF_DEATH)[number]["value"]
export const CIRCUMSTANCE_OF_DEATH_VALUES = values(CIRCUMSTANCE_OF_DEATH)

/** SRTR hypertension / diabetes history duration bands. */
export const HISTORY_DURATION = [
  { value: "no", label: "No" },
  { value: "0-5", label: "Yes, 0–5 years" },
  { value: "6-10", label: "Yes, 6–10 years" },
  { value: ">10", label: "Yes, more than 10 years" },
  { value: "yes_unknown", label: "Yes, duration unknown" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type HistoryDuration = (typeof HISTORY_DURATION)[number]["value"]
export const HISTORY_DURATION_VALUES = values(HISTORY_DURATION)

export const hasHistory = (v: HistoryDuration): boolean | null =>
  v === "no" ? false : v === "unknown" ? null : true

export const LVEF_METHOD = [
  { value: "echo", label: "Echocardiogram" },
  { value: "muga", label: "MUGA" },
  { value: "angiogram", label: "Angiogram" },
  { value: "mri", label: "Cardiac MRI" },
] as const satisfies ReadonlyArray<Option>
export type LvefMethod = (typeof LVEF_METHOD)[number]["value"]
export const LVEF_METHOD_VALUES = values(LVEF_METHOD)

export const WALL_MOTION = [
  { value: "normal", label: "Normal" },
  { value: "segmental", label: "Segmental abnormality" },
  { value: "global", label: "Global hypokinesis" },
  { value: "unknown", label: "Not assessed" },
] as const satisfies ReadonlyArray<Option>
export type WallMotion = (typeof WALL_MOTION)[number]["value"]
export const WALL_MOTION_VALUES = values(WALL_MOTION)

export const VALVE_FINDING = [
  { value: "none", label: "None / trivial" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Not assessed" },
] as const satisfies ReadonlyArray<Option>
export type ValveFinding = (typeof VALVE_FINDING)[number]["value"]
export const VALVE_FINDING_VALUES = values(VALVE_FINDING)

export const RV_FUNCTION = [
  { value: "normal", label: "Normal" },
  { value: "mild", label: "Mildly reduced" },
  { value: "moderate", label: "Moderately reduced" },
  { value: "severe", label: "Severely reduced" },
  { value: "unknown", label: "Not assessed" },
] as const satisfies ReadonlyArray<Option>
export type RvFunction = (typeof RV_FUNCTION)[number]["value"]
export const RV_FUNCTION_VALUES = values(RV_FUNCTION)

/** SRTR DON_CORONARY_ANGIO. */
export const CORONARY_ANGIO = [
  { value: "not_done", label: "Not done" },
  { value: "normal", label: "Done, normal" },
  { value: "abnormal", label: "Done, abnormal" },
] as const satisfies ReadonlyArray<Option>
export type CoronaryAngio = (typeof CORONARY_ANGIO)[number]["value"]
export const CORONARY_ANGIO_VALUES = values(CORONARY_ANGIO)

/** Copeland 2023 donor malignancy transmission-risk tiers. */
export const MALIGNANCY_RISK = [
  { value: "none", label: "No malignancy history" },
  { value: "minimal", label: "Minimal risk (<0.1%)" },
  { value: "low", label: "Low risk (0.1–1%)" },
  { value: "intermediate", label: "Intermediate risk (1–10%)" },
  { value: "high", label: "High risk (>10%)" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type MalignancyRisk = (typeof MALIGNANCY_RISK)[number]["value"]
export const MALIGNANCY_RISK_VALUES = values(MALIGNANCY_RISK)

export const CNS_INFECTION = [
  { value: "none", label: "None" },
  { value: "bacterial_treated", label: "Bacterial meningitis, treated" },
  { value: "bacterial_untreated", label: "Bacterial meningitis, not yet treated" },
  { value: "viral_fungal_amebic", label: "Viral, fungal or amebic meningoencephalitis" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type CnsInfection = (typeof CNS_INFECTION)[number]["value"]
export const CNS_INFECTION_VALUES = values(CNS_INFECTION)

export const DONOR_ECMO = [
  { value: "none", label: "None" },
  { value: "vv", label: "VV-ECMO" },
  { value: "va_weaned", label: "VA-ECMO, weaned" },
  { value: "va_ongoing", label: "VA-ECMO, ongoing" },
] as const satisfies ReadonlyArray<Option>
export type DonorEcmo = (typeof DONOR_ECMO)[number]["value"]
export const DONOR_ECMO_VALUES = values(DONOR_ECMO)

export const CHEST_XRAY = [
  { value: "not_done", label: "Not done" },
  { value: "normal", label: "Normal" },
  { value: "abnormal_left", label: "Abnormal, left" },
  { value: "abnormal_right", label: "Abnormal, right" },
  { value: "abnormal_both", label: "Abnormal, both" },
  { value: "unknown", label: "Unknown" },
] as const satisfies ReadonlyArray<Option>
export type ChestXray = (typeof CHEST_XRAY)[number]["value"]
export const CHEST_XRAY_VALUES = values(CHEST_XRAY)

/** 2020 U.S. PHS guideline: 10 risk criteria, 30 days before procurement. */
export const PHS_RISK_CRITERIA = [
  { value: "sex_known_infected", label: "Sex with a person known or suspected to have HIV, HBV or HCV" },
  { value: "msm", label: "Man who has had sex with another man" },
  { value: "sex_for_money", label: "Sex in exchange for money or drugs" },
  { value: "sex_with_sex_worker", label: "Sex with a person who had sex in exchange for money or drugs" },
  { value: "idu", label: "Drug injection for nonmedical reasons" },
  { value: "sex_with_idu", label: "Sex with a person who injected drugs for nonmedical reasons" },
  { value: "incarceration", label: "Incarcerated 72 or more consecutive hours" },
  { value: "breastfed_hiv", label: "Child breastfed by a mother with HIV" },
  { value: "born_to_infected", label: "Child born to a mother with HIV, HBV or HCV" },
  { value: "unknown_history", label: "Unknown medical or social history" },
] as const satisfies ReadonlyArray<Option>
export type PhsRiskCriterion = (typeof PHS_RISK_CRITERIA)[number]["value"]
export const PHS_RISK_VALUES = values(PHS_RISK_CRITERIA)

export const PRESERVATION = [
  { value: "static_cold", label: "Static cold storage (ice)" },
  { value: "controlled_hypothermic", label: "Controlled hypothermic storage (4–8 °C)" },
  { value: "hope", label: "Hypothermic oxygenated perfusion" },
  { value: "ocs_normothermic", label: "Normothermic ex vivo perfusion (OCS)" },
] as const satisfies ReadonlyArray<Option>
export type Preservation = (typeof PRESERVATION)[number]["value"]
export const PRESERVATION_VALUES = values(PRESERVATION)

export const CROSSMATCH = [
  { value: "not_done", label: "Not done" },
  { value: "negative", label: "Negative" },
  { value: "positive", label: "Positive" },
] as const satisfies ReadonlyArray<Option>
export type Crossmatch = (typeof CROSSMATCH)[number]["value"]
export const CROSSMATCH_VALUES = values(CROSSMATCH)

/* ------------------------------------------------------------------ */
/* Serology panels                                                     */
/* ------------------------------------------------------------------ */

/** OPTN Policy 2.9 deceased-donor tests relevant to heart. */
export const DONOR_TESTS = [
  { value: "hivAbAg", label: "HIV antibody / Ag-Ab combo", group: "Required (OPTN 2.9)" },
  { value: "hivNat", label: "HIV RNA NAT", group: "Required (OPTN 2.9)" },
  { value: "hbsAg", label: "HBsAg", group: "Required (OPTN 2.9)" },
  { value: "antiHbc", label: "Total anti-HBc", group: "Required (OPTN 2.9)" },
  { value: "hbvNat", label: "HBV DNA NAT", group: "Required (OPTN 2.9)" },
  { value: "antiHcv", label: "Anti-HCV", group: "Required (OPTN 2.9)" },
  { value: "hcvNat", label: "HCV RNA NAT", group: "Required (OPTN 2.9)" },
  { value: "cmvIgG", label: "CMV IgG", group: "Required (OPTN 2.9)" },
  { value: "ebvIgG", label: "EBV antibody (VCA IgG)", group: "Required (OPTN 2.9)" },
  { value: "syphilis", label: "Syphilis", group: "Required (OPTN 2.9)" },
  { value: "toxoIgG", label: "Toxoplasma IgG", group: "Required (OPTN 2.9)" },
  { value: "strongyloides", label: "Strongyloides antibody", group: "Required (OPTN 2.9)" },
  { value: "chagas", label: "T. cruzi (Chagas) antibody", group: "Required if born in endemic country" },
  { value: "wnv", label: "West Nile virus NAT", group: "Optional" },
  { value: "sarsCov2", label: "SARS-CoV-2 NAT", group: "Optional" },
] as const satisfies ReadonlyArray<Option>
export type DonorTest = (typeof DONOR_TESTS)[number]["value"]
export const DONOR_TEST_VALUES = values(DONOR_TESTS)

/** Tests OPTN requires for every donor (Chagas is conditional). */
export const DONOR_TESTS_ALWAYS_REQUIRED: ReadonlyArray<DonorTest> = [
  "hivAbAg",
  "hivNat",
  "hbsAg",
  "antiHbc",
  "hbvNat",
  "antiHcv",
  "hcvNat",
  "cmvIgG",
  "ebvIgG",
  "syphilis",
  "toxoIgG",
  "strongyloides",
]

export const RECIPIENT_TESTS = [
  { value: "hiv", label: "HIV" },
  { value: "hbsAg", label: "HBsAg" },
  { value: "antiHbc", label: "Total anti-HBc" },
  { value: "antiHbs", label: "Anti-HBs" },
  { value: "antiHcv", label: "Anti-HCV" },
  { value: "hcvNat", label: "HCV RNA NAT" },
  { value: "cmvIgG", label: "CMV IgG" },
  { value: "ebvIgG", label: "EBV VCA IgG" },
  { value: "toxoIgG", label: "Toxoplasma IgG" },
  { value: "vzvIgG", label: "VZV IgG" },
  { value: "chagas", label: "T. cruzi (Chagas)" },
  { value: "tbIgra", label: "TB (IGRA / TST)" },
] as const satisfies ReadonlyArray<Option>
export type RecipientTest = (typeof RECIPIENT_TESTS)[number]["value"]
export const RECIPIENT_TEST_VALUES = values(RECIPIENT_TESTS)

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

export const DECISION_VERDICT = [
  { value: "accept", label: "Accept offer" },
  { value: "decline", label: "Decline offer" },
  { value: "defer", label: "Defer: more information needed" },
] as const satisfies ReadonlyArray<Option>
export type DecisionVerdict = (typeof DECISION_VERDICT)[number]["value"]
export const DECISION_VERDICT_VALUES = values(DECISION_VERDICT)

/** Modeled on OPTN refusal-code categories (donor, recipient, logistics). */
export const DECLINE_REASON = [
  { value: "donor_quality", label: "Donor heart quality", group: "Donor" },
  { value: "donor_age", label: "Donor age", group: "Donor" },
  { value: "donor_size", label: "Donor size / weight", group: "Donor" },
  { value: "donor_infection", label: "Donor infection risk", group: "Donor" },
  { value: "donor_history", label: "Donor social or medical history", group: "Donor" },
  { value: "positive_crossmatch", label: "Positive or predicted positive crossmatch", group: "Immunology" },
  { value: "abo", label: "Blood type", group: "Immunology" },
  { value: "recipient_ill", label: "Candidate too sick", group: "Candidate" },
  { value: "recipient_unavailable", label: "Candidate unavailable or refused", group: "Candidate" },
  { value: "ischemic_time", label: "Ischemic time / distance", group: "Logistics" },
  { value: "logistics", label: "Transport or OR logistics", group: "Logistics" },
  { value: "other", label: "Other", group: "Other" },
] as const satisfies ReadonlyArray<Option>
export type DeclineReason = (typeof DECLINE_REASON)[number]["value"]
export const DECLINE_REASON_VALUES = values(DECLINE_REASON)
