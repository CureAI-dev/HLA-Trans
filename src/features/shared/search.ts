import { z } from "zod"

/** A calendar day in the URL (YYYY-MM-DD), used by list date filters. */
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
