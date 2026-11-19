import { z } from "zod"

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })
const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
})
export type ServerEnv = z.infer<typeof envSchema>

const authEnvSchema = z.object({
  /** Managed Better Auth URL from the Neon Console (Auth page, Configuration tab). */
  NEON_AUTH_BASE_URL: z.url({ protocol: /^https?$/ }),
  /** Signs the cached session cookie. Generate with `openssl rand -base64 32`. */
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
})
export type AuthEnv = z.infer<typeof authEnvSchema>

function load<TSchema extends z.ZodType>(
  schema: TSchema,
  needed: string
): z.infer<TSchema> {
  if (!process.env[needed]) {
    try {
      // Vite does not copy non-VITE_ variables into process.env; Bun does.
      // On Workers, vars and secrets are already in process.env (nodejs_compat) and this throws.
      process.loadEnvFile()
    } catch {
      /* No .env file: validation below reports the missing variable. */
    }
  }
  const parsed = schema.safeParse(process.env)
  if (!parsed.success)
    throw new Error(
      `Invalid server environment (${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}). Copy .env.example to .env.`
    )
  return parsed.data
}

let cached: ServerEnv | undefined
let cachedAuth: AuthEnv | undefined

/** Database settings, validated once per process. Not used on Workers (Hyperdrive binding instead). */
export function env(): ServerEnv {
  return (cached ??= load(envSchema, "DATABASE_URL"))
}

/** Neon Auth settings, validated once per process. */
export function authEnv(): AuthEnv {
  return (cachedAuth ??= load(authEnvSchema, "NEON_AUTH_BASE_URL"))
}
