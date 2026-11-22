import { useEffect, useState } from "react"

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "just now"
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour")
  if (abs < 86_400 * 30) return rtf.format(Math.round(seconds / 86_400), "day")
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
}

/** 83_000 → "1m 23s" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`
}

/** Re-renders every `ms` while `active`; returns the current time. */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}
