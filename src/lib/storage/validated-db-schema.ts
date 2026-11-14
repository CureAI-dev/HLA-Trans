import { validateCriteria } from "../../domain/criteria"
import { dbSchema } from "../../domain/schema"

/** Shared import-preview, import-action and persisted-store invariant. */
export const validatedDbSchema = dbSchema.superRefine((db, ctx) => {
  db.criteriaVersions.forEach((version, index) => {
    for (const issue of validateCriteria(version.criteria)) {
      ctx.addIssue({
        code: "custom",
        path: ["criteriaVersions", index, "criteria", ...issue.path.split(".")],
        message: issue.message,
      })
    }
  })
})
