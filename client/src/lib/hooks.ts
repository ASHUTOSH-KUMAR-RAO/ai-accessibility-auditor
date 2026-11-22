import { useEffect, useState, useSyncExternalStore } from "react"

/** Blob → object URL with cleanup (the screenshot endpoint needs the auth header, so <img src> can't call it directly). */
export function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource (object URL)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)")

/** Debounced copy of a value (for search boxes that write to the URL). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Copies text; resolves true on success. Falls back to a hidden textarea where the async clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text })
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  }
}

/** false on the server and during hydration, true afterwards: for UI that depends on browser-only state (session, theme). */
const subscribe = () => () => {}
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false)
