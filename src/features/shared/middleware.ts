import { createMiddleware } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { isNotFound, isRedirect } from "@tanstack/react-router"
import { AppError, toAppError } from "@/lib/app-error"
import { CLINICIAN_COOKIE } from "@/lib/prefs"

/** Outermost: every thrown value leaves the server as a typed AppError (or router control flow). */
export const errorMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (isRedirect(error) || isNotFound(error)) throw error
      throw toAppError(error)
    }
  }
)

export const actorMiddleware = createMiddleware({ type: "function" })
  .middleware([errorMiddleware])
  .server(async ({ next }) => {
    const actor = (getCookie(CLINICIAN_COOKIE) ?? "").trim().slice(0, 200)
    return next({ context: { actor } })
  })

/** Writes are attributed. Without a name the UI prompts (CLINICIAN_REQUIRED). */
export const writeMiddleware = createMiddleware({ type: "function" })
  .middleware([actorMiddleware])
  .server(async ({ next, context }) => {
    if (!context.actor)
      throw new AppError(
        "CLINICIAN_REQUIRED",
        "Enter your name in the header before saving changes."
      )
    return next()
  })
