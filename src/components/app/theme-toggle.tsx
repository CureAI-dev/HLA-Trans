import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const THEME_KEY = "hla-trans.theme"
export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY)
      return stored
        ? stored === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light")
    } catch {
      /* Theme still works when persistence is blocked. */
    }
  }, [dark])
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => setDark(!dark)}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
