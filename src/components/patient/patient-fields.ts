export const patientFieldLabels: Record<
  string,
  { label: string; unit?: string } | undefined
> = {
  "identity.mrn": {
    label: "Medical record number *",
  },
  "identity.firstName": {
    label: "First name *",
  },
  "identity.lastName": {
    label: "Last name *",
  },
  "identity.dateOfBirth": {
    label: "Date of birth *",
  },
  "identity.sex": {
    label: "Sex *",
  },
  "identity.ethnicity": {
    label: "Ethnicity",
  },
  "identity.transplantCenter": {
    label: "Transplant center",
  },
  "identity.attendingPhysician": {
    label: "Attending physician",
  },
  "listing.state": {
    label: "State",
  },
  "listing.listingDate": {
    label: "Listing date",
  },
  "listing.statusCriterion": {
    label: "Status criterion",
  },
  "listing.statusDate": {
    label: "Status date",
  },
  "listing.statusExpiresOn": {
    label: "Status expires on",
  },
  "listing.multiOrgan": {
    label: "Multi-organ candidate",
  },
  "listing.otherOrgans": {
    label: "Other organs",
  },
  "body.heightCm": {
    label: "Height",
    unit: "cm",
  },
  "body.weightKg": {
    label: "Weight",
    unit: "kg",
  },
  "blood.subtype": {
    label: "Subtype",
  },
  "blood.verifiedTwoSamples": {
    label: "ABO verified by two independent samples",
  },
  "blood.acceptsIncompatible": {
    label: "Accept intended ABO-incompatible pediatric offers",
  },
  "blood.antiATiter": {
    label: "Anti-A titer denominator (1:x)",
    unit: "denominator",
  },
  "blood.antiBTiter": {
    label: "Anti-B titer denominator (1:x)",
    unit: "denominator",
  },
  "blood.titerDate": {
    label: "Titer date",
  },
  "blood.titerLoweringTherapyWithin30Days": {
    label: "Titer-lowering therapy within 30 days",
  },
  "diagnosis.detail": {
    label: "Detail",
  },
  "diagnosis.diagnosisDate": {
    label: "Diagnosis date",
  },
  "hemodynamics.catheterizationDate": {
    label: "Catheterization date",
  },
  "hemodynamics.paSystolic": {
    label: "PA systolic pressure",
    unit: "mmHg",
  },
  "hemodynamics.paDiastolic": {
    label: "PA diastolic pressure",
    unit: "mmHg",
  },
  "hemodynamics.paMean": {
    label: "PA mean pressure (measured)",
    unit: "mmHg",
  },
  "hemodynamics.pcwp": {
    label: "Pulmonary capillary wedge pressure",
    unit: "mmHg",
  },
  "hemodynamics.rap": {
    label: "Right atrial pressure",
    unit: "mmHg",
  },
  "hemodynamics.cardiacOutput": {
    label: "Cardiac output",
    unit: "L/min",
  },
  "hemodynamics.cardiacIndex": {
    label: "Cardiac index",
    unit: "L/min/m^2",
  },
  "hemodynamics.systolicBp": {
    label: "Systolic blood pressure",
    unit: "mmHg",
  },
  "hemodynamics.meanArterialPressure": {
    label: "Mean arterial pressure",
    unit: "mmHg",
  },
  "hemodynamics.mixedVenousSat": {
    label: "Mixed venous oxygen saturation",
    unit: "%",
  },
  "hemodynamics.onInotropesDuringCath": {
    label: "On inotropes during cath",
  },
  "hemodynamics.vasodilatorChallengeDone": {
    label: "Vasodilator challenge done",
  },
  "hemodynamics.pvrAfterChallenge": {
    label: "PVR after vasodilator challenge",
    unit: "WU",
  },
  "support.device": {
    label: "Device",
  },
  "support.deviceBrand": {
    label: "Device brand",
  },
  "support.deviceImplantDate": {
    label: "Device implant date",
  },
  "support.mechanicalVentilation": {
    label: "Mechanical ventilation",
  },
  "support.inhaledNitricOxide": {
    label: "Inhaled nitric oxide",
  },
  "support.icd": {
    label: "Implantable cardioverter defibrillator",
  },
  "function.lvef": {
    label: "Left ventricular ejection fraction",
    unit: "%",
  },
  "function.peakVo2": {
    label: "Peak VO2",
    unit: "mL/kg/min",
  },
  "function.onBetaBlocker": {
    label: "On beta blocker",
  },
  "function.hospitalized": {
    label: "Hospitalized",
  },
  "function.inIcu": {
    label: "In intensive care",
  },
  "labs.labDate": {
    label: "Lab date",
  },
  "labs.creatinine": {
    label: "Creatinine",
    unit: "mg/dL",
  },
  "labs.egfr": {
    label: "Estimated GFR",
    unit: "mL/min/1.73 m^2",
  },
  "labs.dialysis": {
    label: "Dialysis",
  },
  "labs.bilirubin": {
    label: "Bilirubin",
    unit: "mg/dL",
  },
  "labs.albumin": {
    label: "Albumin",
    unit: "g/dL",
  },
  "labs.inr": {
    label: "INR",
    unit: "ratio",
  },
  "labs.ast": {
    label: "AST",
    unit: "U/L",
  },
  "labs.alt": {
    label: "ALT",
    unit: "U/L",
  },
  "labs.sodium": {
    label: "Sodium",
    unit: "mmol/L",
  },
  "labs.bnp": {
    label: "BNP",
    unit: "pg/mL",
  },
  "labs.ntProBnp": {
    label: "NT-proBNP",
    unit: "pg/mL",
  },
  "labs.hba1c": {
    label: "HbA1c",
    unit: "%",
  },
  "labs.hemoglobin": {
    label: "Hemoglobin",
    unit: "g/dL",
  },
  "labs.lactate": {
    label: "Lactate",
    unit: "mmol/L",
  },
  "history.diabetes": {
    label: "Diabetes",
  },
  "history.diabetesEndOrganDamage": {
    label: "Diabetes end organ damage",
  },
  "history.priorSternotomies": {
    label: "Prior sternotomies",
    unit: "count",
  },
  "history.priorCardiacSurgery": {
    label: "Prior cardiac surgery details",
  },
  "history.malignancyHistory": {
    label: "Malignancy history",
  },
  "history.malignancyDetail": {
    label: "Malignancy detail",
  },
  "history.cerebrovascularDisease": {
    label: "Cerebrovascular disease",
  },
  "history.peripheralVascularDisease": {
    label: "Peripheral vascular disease",
  },
  "history.smoking": {
    label: "Smoking",
  },
  "history.smokingQuitDate": {
    label: "Smoking quit date",
  },
  "history.substanceUse": {
    label: "Substance use",
  },
  "history.frailty": {
    label: "Frailty",
  },
  "history.psychosocialConcerns": {
    label: "Psychosocial concerns",
  },
  "sensitization.cpra": {
    label: "Current cPRA (reported by lab)",
    unit: "%",
  },
  "sensitization.cpraPeak": {
    label: "Peak cPRA",
    unit: "%",
  },
  "sensitization.cpraDate": {
    label: "cPRA test date",
  },
  "sensitization.pregnancies": {
    label: "Pregnancies",
    unit: "count",
  },
  "sensitization.transfusions": {
    label: "Transfusions",
  },
  "sensitization.priorTransplants": {
    label: "Prior transplants",
    unit: "count",
  },
  "sensitization.priorHomograft": {
    label: "Prior homograft",
  },
  "sensitization.desensitization": {
    label: "Desensitization notes",
  },
  "acceptance.maxDonorAge": {
    label: "Maximum donor age",
    unit: "years",
  },
  "acceptance.minDonorWeightKg": {
    label: "Minimum donor weight",
    unit: "kg",
  },
  "acceptance.maxDonorWeightKg": {
    label: "Maximum donor weight",
    unit: "kg",
  },
  "acceptance.maxDistanceNm": {
    label: "Maximum donor distance",
    unit: "NM",
  },
  "acceptance.acceptDcd": {
    label: "Accept donation after circulatory death (DCD)",
  },
  "acceptance.acceptHcvNat": {
    label: "Accept HCV NAT positive",
  },
  "acceptance.acceptHcvAb": {
    label: "Accept HCV antibody positive",
  },
  "acceptance.acceptAntiHbc": {
    label: "Accept anti-HBc positive",
  },
  "acceptance.acceptHbvNat": {
    label: "Accept HBV NAT positive",
  },
  "acceptance.acceptPhsRisk": {
    label: "Accept PHS risk criteria",
  },
  serologyDate: {
    label: "Serology date",
  },
  enrolledHivResearchProtocol: {
    label: "Enrolled in HIV research protocol (HOPE)",
  },
  notes: {
    label: "Clinical notes",
  },
}
