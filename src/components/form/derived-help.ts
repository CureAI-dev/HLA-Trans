/**
 * "How is this calculated?" copy for the derived-value tiles. The formulas
 * mirror `domain/calc.ts`; the "used for" lines mirror `domain/rules/size.ts`.
 * Update both together.
 */

export type HelpInput = {
  label: string
  /** DOM id of the form control, for the jump link. */
  field: string
  /** Formatted current value, or null when not recorded. */
  value: string | null
}

export type DerivedHelp = {
  formula: string
  inputs: ReadonlyArray<HelpInput>
  usedFor: string
  /** Shown instead of the list of missing inputs when alternatives exist. */
  needs?: string
}

type Copy = Pick<DerivedHelp, "formula" | "usedFor" | "needs">

export const DERIVED_COPY = {
  bmi: {
    formula: "weight (kg) ÷ height (m)²",
    usedFor: "Display only. The WHO category is shown under the value.",
  },
  bsaMosteller: {
    formula: "√(height (cm) × weight (kg) ÷ 3600)  (Mosteller 1987)",
    usedFor:
      "Turns cardiac output into cardiac index when the index was not measured.",
  },
  bsaDuBois: {
    formula: "0.007184 × weight (kg)^0.425 × height (cm)^0.725  (DuBois 1916)",
    usedFor: "Display only. Matching uses Mosteller.",
  },
  phmLv: {
    formula:
      "a × height (m)^0.54 × weight (kg)^0.61; a = 8.25 male, 6.82 female  (Reed 2014)",
    usedFor: "Part of the total predicted heart mass.",
  },
  phmRv: {
    formula:
      "a × age^−0.32 × height (m)^1.135 × weight (kg)^0.315; a = 11.25 male, 10.59 female  (Reed 2014)",
    usedFor: "Part of the total predicted heart mass.",
  },
  phmTotal: {
    formula: "LV mass + RV mass  (Reed 2014)",
    usedFor:
      "Adult size match: donor PHM ÷ recipient PHM. If PHM can't be calculated, the donor-to-recipient weight ratio is used. Under 18, the weight ratio decides and PHM is shown for information.",
  },
  paMean: {
    formula: "Measured value, or diastolic + (systolic − diastolic) ÷ 3",
    usedFor: "Feeds TPG, and from there PVR and PVRI.",
    needs: "PA mean, or PA systolic and diastolic",
  },
  cardiacIndex: {
    formula: "Measured value, or cardiac output ÷ BSA (Mosteller)",
    usedFor: "Feeds PVRI.",
    needs: "Cardiac index, or cardiac output with height and weight",
  },
  tpg: {
    formula: "mean PA pressure − PCWP",
    usedFor: "Feeds PVR and PVRI.",
    needs: "Mean PA (or PA systolic and diastolic) and PCWP",
  },
  dpg: {
    formula: "PA diastolic − PCWP",
    usedFor: "Display only.",
  },
  pvr: {
    formula: "TPG ÷ cardiac output",
    usedFor:
      "Size rule's pulmonary hypertension check: above the criteria threshold, the donor heart must be at least as large as predicted. When a vasodilator challenge was done, the post-challenge PVR is used instead.",
    needs: "Mean PA (or PA systolic and diastolic), PCWP and cardiac output",
  },
  pvri: {
    formula: "TPG ÷ cardiac index",
    usedFor: "Display only.",
    needs:
      "Mean PA (or PA systolic and diastolic), PCWP and cardiac index (or cardiac output with height and weight)",
  },
} as const satisfies Record<string, Copy>

/** Format a recorded value for the inputs list; null stays null. */
export const shown = (
  value: string | number | null | undefined,
  unit = ""
): string | null =>
  value == null || value === "" ? null : `${value}${unit ? ` ${unit}` : ""}`
