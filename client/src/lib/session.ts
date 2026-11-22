/**
 * Access token lives in memory only (never localStorage). A non-sensitive "has session" flag in
 * localStorage tells a fresh page load whether a refresh-cookie probably exists, so anonymous
 * visitors don't fire a pointless /auth/refresh, and it lets other tabs notice sign-in / sign-out.
 */
export const SESSION_FLAG = "accesslens:session"

let accessToken: string | null = null
const signedOutListeners = new Set<() => void>()

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback // storage blocked (private mode, etc.)
  }
}

export const session = {
  getToken: () => accessToken,
  hasSession: () => safe(() => localStorage.getItem(SESSION_FLAG) === "1", false),
  setToken(token: string) {
    accessToken = token
    safe(() => localStorage.setItem(SESSION_FLAG, "1"), undefined)
  },
  /** Drops the in-memory token (e.g. another tab signed out) without touching storage. */
  dropToken() {
    accessToken = null
  },
  clear() {
    accessToken = null
    safe(() => localStorage.removeItem(SESSION_FLAG), undefined)
    signedOutListeners.forEach((fn) => fn())
  },
  onSignedOut(fn: () => void) {
    signedOutListeners.add(fn)
    return () => void signedOutListeners.delete(fn)
  },
}
