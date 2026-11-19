import { createMiddleware } from "@tanstack/react-start"
import { isNotFound, isRedirect } from "@tanstack/react-router"
import { AppError, toAppError } from "@/lib/app-error"
import { currentUser } from "@/server/auth.server"

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

/** Clinical data: every read and write needs a signed-in user (UNAUTHENTICATED otherwise). */
export const readMiddleware = createMiddleware({ type: "function" })
  .middleware([errorMiddleware])
  .server(async ({ next }) => {
    const user = await currentUser()
    if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to continue.")
    return next({ context: { user, actor: user.name } })
  })

/** Writes are attributed to the signed-in user via `context.actor`. */
export const writeMiddleware = readMiddleware
