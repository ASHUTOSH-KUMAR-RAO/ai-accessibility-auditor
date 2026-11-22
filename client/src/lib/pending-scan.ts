// A visitor who types a URL on the landing page before signing up: remember it, scan it right after they are in.
const KEY = "accesslens:pending-url"
const MAX_AGE_MS = 60 * 60 * 1000

export function setPendingUrl(url: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ url, at: Date.now() }))
  } catch {
    /* storage blocked: the visitor just has to type it again */
  }
}

/** Reads and clears the remembered URL (one use only, expires after an hour). */
export function takePendingUrl(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { url?: unknown; at?: unknown }
    return typeof v.url === "string" && typeof v.at === "number" && Date.now() - v.at < MAX_AGE_MS ? v.url : null
  } catch {
    return null
  }
}
