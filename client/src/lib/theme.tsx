import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ThemeContext, THEME_KEY, type Theme } from "./theme-store"

const read = (): Theme => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches

/**
 * Light / dark / system. The first paint is handled by the inline script in index.html (no flash);
 * this provider keeps React, the <html> class and localStorage in sync afterwards, across tabs too.
 * (Replaces next-themes, whose injected <script> triggers a React 19 console error.)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(read)
  const [prefersDark, setPrefersDark] = useState(systemDark)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setPrefersDark(mq.matches)
    const onStorage = (e: StorageEvent) => e.key === THEME_KEY && setThemeState(read())
    mq.addEventListener("change", onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      mq.removeEventListener("change", onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      if (t === "system") localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, t)
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}
