import { getRouteApi, useRouter } from "@tanstack/react-router"
import { Moon, Sun } from "lucide-react"
import { THEME_COOKIE, writePrefCookie } from "@/lib/prefs"
import { Button } from "@/components/ui/button"

const rootRoute = getRouteApi("__root__")

/** The theme lives in a cookie so the server renders the right class (no flash). */
export function ThemeToggle() {
  const { prefs } = rootRoute.useRouteContext()
  const router = useRouter()
  const dark = prefs.theme === "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => {
        const next = dark ? "light" : "dark"
        writePrefCookie(THEME_COOKIE, next)
        document.documentElement.classList.toggle("dark", next === "dark")
        document.documentElement.style.colorScheme = next
        void router.invalidate()
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
