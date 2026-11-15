import { z } from "zod"

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })
const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
})
export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | undefined

/** Validated once per process. Throws a readable error instead of failing on first query. */
export function env(): ServerEnv {
  if (cached) return cached
  if (!process.env.DATABASE_URL) {
    try {
      // Vite does not copy non-VITE_ variables into process.env; Bun does.
      process.loadEnvFile()
    } catch {
      /* No .env file: validation below reports the missing variable. */
    }
  }
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success)
    throw new Error(
      `Invalid server environment (${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}). Copy .env.example to .env.`
    )
  cached = parsed.data
  return cached
}
