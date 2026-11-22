import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { get, post, refreshAccessToken } from "@/lib/api"
import { SESSION_FLAG, session } from "@/lib/session"
import { AuthContext, type AuthContextValue, type AuthStatus, type Credentials, type Registration, type User } from "./auth-store"

interface AuthPayload { user: User; accessToken: string }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (session.hasSession() ? "loading" : "anonymous"))

  const signedOut = useCallback(() => {
    setUser(null)
    setStatus("anonymous")
  }, [])

  // On app load: trade the refresh cookie for an access token, then fetch /me.
  const bootstrap = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      await refreshAccessToken()
      const { user } = await get<{ user: User }>("/auth/me")
      if (isCancelled()) return
      setUser(user)
      setStatus("authenticated")
    } catch {
      // 401 already cleared the session (→ signedOut listener). A network failure just leaves us anonymous
      // while keeping the flag, so a later reload can recover.
      if (!isCancelled()) signedOut()
    }
  }, [signedOut])

  useEffect(() => {
    let cancelled = false
    // bootstrap is async: state is only set after awaiting the network, never synchronously here
    // oxlint-disable-next-line react/set-state-in-effect
    if (session.hasSession()) void bootstrap(() => cancelled)
    const off = session.onSignedOut(signedOut)

    // Cross-tab sync: another tab signed in or out.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_FLAG) return
      if (e.newValue === null) {
        session.dropToken()
        signedOut()
      } else {
        void bootstrap()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      cancelled = true
      off()
      window.removeEventListener("storage", onStorage)
    }
  }, [bootstrap, signedOut])

  const accept = useCallback(({ user, accessToken }: AuthPayload) => {
    session.setToken(accessToken)
    setUser(user)
    setStatus("authenticated")
  }, [])

  const login = useCallback(async (values: Credentials) => accept(await post<AuthPayload>("/auth/login", values)), [accept])
  const register = useCallback(async (values: Registration) => accept(await post<AuthPayload>("/auth/register", values)), [accept])

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout")
    } catch {
      // Offline or already expired: still sign out locally.
    }
    session.clear()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, status, login, register, logout }), [user, status, login, register, logout])
  return <AuthContext value={value}>{children}</AuthContext>
}

