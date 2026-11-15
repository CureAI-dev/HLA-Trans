import { createSerializationAdapter } from "@tanstack/react-router"
import { ZodError } from "zod"

export const APP_ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "CLINICIAN_REQUIRED",
  "INTERNAL",
] as const
export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly issues: Record<string, string>
  constructor(
    code: AppErrorCode,
    message: string,
    issues: Record<string, string> = {}
  ) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.issues = issues
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError

const ownCode = (e: unknown): string | undefined =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  typeof e.code === "string"
    ? e.code
    : undefined

/** Drizzle wraps driver errors (DrizzleQueryError); the Postgres SQLSTATE is on `cause`. */
const pgCode = (e: unknown): string | undefined =>
  ownCode(e) ??
  (e instanceof Error && e.cause !== undefined ? ownCode(e.cause) : undefined)

/** Server-side normaliser. Never leaks driver messages for unknown errors. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof ZodError) {
    const issues: Record<string, string> = {}
    for (const issue of error.issues)
      issues[issue.path.join(".")] ??= issue.message
    return new AppError("VALIDATION", "Some fields are invalid.", issues)
  }
  switch (pgCode(error)) {
    case "23505":
      return new AppError(
        "CONFLICT",
        "A record with the same identifier already exists."
      )
    case "23503":
      return new AppError(
        "CONFLICT",
        "A related record no longer exists. Reload and try again."
      )
    case "40001":
    case "40P01":
      return new AppError(
        "CONFLICT",
        "Another change happened at the same time. Try again."
      )
  }
  console.error("[server] unexpected error:", error)
  return new AppError(
    "INTERNAL",
    "Something went wrong on the server. Your data was not changed."
  )
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * Router's default error plugin keeps only `message`. This adapter (registered in
 * src/start.ts, ahead of the defaults) carries `code` and `issues` to the browser.
 */
export const appErrorAdapter = createSerializationAdapter({
  key: "hla/AppError",
  test: (value: unknown): value is AppError => value instanceof AppError,
  toSerializable: (e: AppError) => ({
    code: e.code,
    message: e.message,
    issues: e.issues,
  }),
  fromSerializable: (v: {
    code: AppErrorCode
    message: string
    issues: Record<string, string>
  }) => new AppError(v.code, v.message, v.issues),
})
