import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

export const THEME_COOKIE = "hla_theme"
export const CLINICIAN_COOKIE = "hla_clinician"
export type Theme = "light" | "dark"
export type Prefs = { theme: Theme; clinician: string }

/** `get` returns already-decoded cookie values. */
export function parsePrefs(get: (name: string) => string | undefined): Prefs {
  return {
    theme: get(THEME_COOKIE) === "dark" ? "dark" : "light",
    clinician: (get(CLINICIAN_COOKIE) ?? "").trim().slice(0, 200),
  }
}

function documentCookie(name: string): string | undefined {
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=")
    if (eq > 0 && part.slice(0, eq) === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** Server: request cookies (h3 decodes). Client: document.cookie. Runs in the root beforeLoad. */
export const readPrefs = createIsomorphicFn()
  .server((): Prefs => parsePrefs(getCookie))
  .client((): Prefs => parsePrefs(documentCookie))

export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}
