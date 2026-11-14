import { expect, test } from "vitest"
import {
  CRITERIA_FIELDS,
  DEFAULT_CRITERIA,
  validateCriteria,
} from "../criteria"
import { criteriaSchema } from "../schema"
import type { Criteria } from "../schema"

test("defaults satisfy the schema and cross-field ordering rules", () => {
  expect(criteriaSchema.safeParse(DEFAULT_CRITERIA).success).toBe(true)
  expect(validateCriteria(DEFAULT_CRITERIA)).toEqual([])
})

test("every criteria key has exactly one settings descriptor, including sources", () => {
  const described = CRITERIA_FIELDS.map(
    (field) => `${field.section}.${field.key}`
  )
  const actual = Object.entries(DEFAULT_CRITERIA).flatMap(([section, values]) =>
    Object.keys(values).map((key) => `${section}.${key}`)
  )
  // Compare arrays, not sets: duplicate descriptors must fail this contract.
  expect([...described].sort()).toEqual(actual.sort())
  for (const field of CRITERIA_FIELDS) {
    expect(field.source.trim().length).toBeGreaterThan(0)
    expect(field.label.trim().length).toBeGreaterThan(0)
    const values: Record<string, unknown> = DEFAULT_CRITERIA[field.section]
    const value = values[field.key]
    expect(field.kind).toBe(
      value === null
        ? "number"
        : typeof value === "string"
          ? "outcome"
          : typeof value
    )
    if (field.kind === "number") expect(field.step).toBeGreaterThan(0)
  }
})

type OrderingCase = {
  name: string
  path: string
  setBoundary: (criteria: Criteria, offset: number) => void
  equalAllowed: boolean
}

const orderings: Array<OrderingCase> = [
  {
    name: "PHM review minimum",
    path: "size.phmRatioReviewMin",
    setBoundary: (c, d) => {
      c.size.phmRatioReviewMin = c.size.phmRatioPassMin + d
    },
    equalAllowed: true,
  },
  {
    name: "PHM oversize maximum",
    path: "size.phmRatioReviewMax",
    setBoundary: (c, d) => {
      c.size.phmRatioReviewMax = c.size.phmRatioPassMin - d
    },
    equalAllowed: false,
  },
  {
    name: "weight review minimum",
    path: "size.weightRatioReviewMin",
    setBoundary: (c, d) => {
      c.size.weightRatioReviewMin = c.size.weightRatioPassMin + d
    },
    equalAllowed: true,
  },
  {
    name: "pediatric weight range",
    path: "size.pediatricWeightRatioMax",
    setBoundary: (c, d) => {
      c.size.pediatricWeightRatioMax = c.size.pediatricWeightRatioMin - d
    },
    equalAllowed: false,
  },
  {
    name: "MFI fail minimum",
    path: "immunology.mfiFailMin",
    setBoundary: (c, d) => {
      c.immunology.mfiFailMin = c.immunology.mfiReviewMin - d
    },
    equalAllowed: true,
  },
  {
    name: "LVEF review minimum",
    path: "donor.lvefReviewMin",
    setBoundary: (c, d) => {
      c.donor.lvefReviewMin = c.donor.lvefPassMin + d
    },
    equalAllowed: true,
  },
  {
    name: "wall thickness review maximum",
    path: "donor.wallThicknessReviewMax",
    setBoundary: (c, d) => {
      c.donor.wallThicknessReviewMax = c.donor.wallThicknessPassMax - d
    },
    equalAllowed: true,
  },
  {
    name: "sodium low thresholds",
    path: "donor.sodiumReviewBelow",
    setBoundary: (c, d) => {
      c.donor.sodiumReviewBelow = c.donor.sodiumFailBelow - d
    },
    equalAllowed: true,
  },
  {
    name: "sodium review range",
    path: "donor.sodiumReviewAbove",
    setBoundary: (c, d) => {
      c.donor.sodiumReviewBelow = 145
      c.donor.sodiumReviewAbove = 145 - d
    },
    equalAllowed: false,
  },
  {
    name: "sodium high thresholds",
    path: "donor.sodiumFailAtOrAbove",
    setBoundary: (c, d) => {
      c.donor.sodiumFailAtOrAbove = c.donor.sodiumReviewAbove - d
    },
    equalAllowed: false,
  },
  {
    name: "age fail limit",
    path: "donor.ageFailAbove",
    setBoundary: (c, d) => {
      c.donor.ageFailAbove = c.donor.ageReviewAbove - d
    },
    equalAllowed: true,
  },
  {
    name: "cold ischemia review maximum",
    path: "logistics.ischemicReviewMaxMinutes",
    setBoundary: (c, d) => {
      c.logistics.ischemicReviewMaxMinutes =
        c.logistics.ischemicPassMaxMinutes - d
    },
    equalAllowed: true,
  },
  {
    name: "DCD warm ischemia review maximum",
    path: "logistics.dcdFwitReviewMaxMinutes",
    setBoundary: (c, d) => {
      c.logistics.dcdFwitReviewMaxMinutes =
        c.logistics.dcdFwitPassMaxMinutes - d
    },
    equalAllowed: true,
  },
]

test.each(orderings)(
  "reports inverted $name at the editable field",
  ({ path, setBoundary }) => {
    const criteria = structuredClone(DEFAULT_CRITERIA)
    setBoundary(criteria, 0.01)
    const issues = validateCriteria(criteria)
    expect(issues.map((issue) => issue.path)).toContain(path)
    expect(
      issues.find((issue) => issue.path === path)?.message.trim().length
    ).toBeGreaterThan(0)
  }
)

test.each(orderings)(
  "enforces the equality boundary for $name",
  ({ path, setBoundary, equalAllowed }) => {
    const criteria = structuredClone(DEFAULT_CRITERIA)
    setBoundary(criteria, 0)
    expect(
      validateCriteria(criteria).some((issue) => issue.path === path)
    ).toBe(!equalAllowed)
  }
)

test("a null age limit is disabled while zero remains a real threshold", () => {
  const criteria = structuredClone(DEFAULT_CRITERIA)
  expect(criteria.donor.ageFailAbove).toBeNull()
  expect(criteriaSchema.parse(criteria).donor.ageFailAbove).toBeNull()
  expect(validateCriteria(criteria)).toEqual([])
  criteria.donor.ageFailAbove = 0
  expect(criteriaSchema.parse(criteria).donor.ageFailAbove).toBe(0)
  expect(validateCriteria(criteria).map((issue) => issue.path)).toContain(
    "donor.ageFailAbove"
  )
  criteria.donor.ageReviewAbove = 0
  expect(validateCriteria(criteria)).toEqual([])
})

test.each([-1, 100.01, Number.NaN, Number.POSITIVE_INFINITY])(
  "schema rejects invalid cPRA threshold %s",
  (value) => {
    const criteria = structuredClone(DEFAULT_CRITERIA)
    criteria.immunology.cpraSensitizedMin = value
    const parsed = criteriaSchema.safeParse(criteria)
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(
        parsed.error.issues.map((issue) => issue.path.join("."))
      ).toContain("immunology.cpraSensitizedMin")
  }
)

test.each([0, 100])(
  "schema accepts cPRA endpoint %s without treating zero as missing",
  (value) => {
    const criteria = structuredClone(DEFAULT_CRITERIA)
    criteria.immunology.cpraSensitizedMin = value
    expect(criteriaSchema.parse(criteria).immunology.cpraSensitizedMin).toBe(
      value
    )
    expect(validateCriteria(criteria)).toEqual([])
  }
)
