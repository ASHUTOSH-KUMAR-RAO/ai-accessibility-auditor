import { useCallback, useState } from "react"

/** A boolean remembered in localStorage. Storage can be blocked (private mode): then it simply is not remembered. */
export function usePersistentFlag(key: string, initial = false) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v === null ? initial : v === "1"
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) =>
      setValue((prev) => {
        const v = typeof next === "function" ? next(prev) : next
        try {
          localStorage.setItem(key, v ? "1" : "0")
        } catch {
          /* ignore */
        }
        return v
      }),
    [key],
  )
  return [value, set] as const
}
