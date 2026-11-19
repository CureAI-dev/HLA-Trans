import { createAuthServer, extractNeonAuthCookies } from "@neon/auth/server"
import type { NeonAuthServer } from "@neon/auth/server"
import {
  getRequest,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server"
import { authEnv } from "./env.server"
import { AppError } from "@/lib/app-error"

/**
 * Neon Managed Better Auth, called from server functions only. The browser never talks to
 * Neon directly: sign-in/up/out run here and the session cookies are set on our own domain,
 * so SSR and server functions can read the session from the request.
 */
let server: NeonAuthServer | undefined

export function auth(): NeonAuthServer {
  if (server) return server
  const { NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } = authEnv()
  server = createAuthServer({
    baseUrl: NEON_AUTH_BASE_URL,
    cookieSecret: NEON_AUTH_COOKIE_SECRET,
    sameSite: "lax",
    context: () => ({
      getCookies: () =>
        extractNeonAuthCookies(getRequestHeader("cookie") ?? ""),
      setCookie: (name, value, options) => setCookie(name, value, options),
      getHeader: (name) => getRequestHeader(name) ?? null,
      // Neon checks this against the branch's trusted domains.
      getOrigin: () =>
        getRequestHeader("origin") ?? new URL(getRequest().url).origin,
      getFramework: () => "tanstack-start",
    }),
  })
  return server
}

export type SessionUser = { id: string; name: string; email: string }

/** The signed-in user, or null. Never throws for a missing or expired session. */
export async function currentUser(): Promise<SessionUser | null> {
  const { data } = await auth().getSession()
  const user = data?.user
  if (!user) return null
  return { id: user.id, name: user.name || user.email, email: user.email }
}

/** Better Auth error → message safe to show on the sign-in form. */
function authMessage(error: { message?: string; status?: number }): string {
  if (error.status === 401 || error.status === 403)
    return "Email or password is incorrect."
  return error.message || "Sign-in failed. Try again."
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await auth().signIn.email({ email, password })
  if (error) throw new AppError("VALIDATION", authMessage(error))
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
) {
  const { error } = await auth().signUp.email({ name, email, password })
  if (error) throw new AppError("VALIDATION", authMessage(error))
}

export async function signOutCurrent() {
  await auth().signOut()
}
