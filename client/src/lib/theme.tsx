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
  // The first render (also the server render and the hydration pass) must be identical everywhere: "system", light.
  // The real values are read right after mount; the inline script in index.html has already set the <html> class, so nothing flashes.
  const [theme, setThemeState] = useState<Theme>("system")
  const [prefersDark, setPrefersDark] = useState(false)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with browser storage after hydration
    setThemeState(read())
    setPrefersDark(systemDark())
    setSynced(true)
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
    if (synced) document.documentElement.classList.toggle("dark", resolvedTheme === "dark") // not before the real values are known: the inline script's class stays until then
  }, [resolvedTheme, synced])

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
