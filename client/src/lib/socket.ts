import { useSyncExternalStore } from "react"
import { io, type Socket } from "socket.io-client"
import { refreshAccessToken } from "@/lib/api"
import { session } from "@/lib/session"

// Same origin by default (Vite proxies /socket.io in dev). Vercel rewrites can't proxy WebSocket upgrades:
// in production set VITE_SOCKET_URL to the API's own origin; auth is the token in the handshake, not cookies.
const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL || undefined

let socket: Socket | null = null
let connected = false
const listeners = new Set<() => void>()
const setConnected = (value: boolean) => {
  if (connected === value) return
  connected = value
  listeners.forEach((l) => l())
}

export const useSocketConnected = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => void listeners.delete(cb)
    },
    () => connected,
    () => false,
  )

const AUTH_ERRORS = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "UNAUTHENTICATED"])

/** Opens (or returns) the single socket. The token is read fresh on every (re)connect attempt. */
export function connectScanSocket(onReconnect: () => void): Socket {
  if (socket) return socket
  const s = io(SOCKET_URL, {
    auth: (cb) => cb({ token: session.getToken() ?? "" }),
    reconnectionDelayMax: 10_000,
  })
  let everConnected = false

  s.on("connect", () => {
    setConnected(true)
    if (everConnected) onReconnect() // events may have been missed while offline: refetch
    everConnected = true
  })
  s.on("disconnect", () => setConnected(false))
  s.on("connect_error", (err) => {
    setConnected(false)
    // Expired access token: refresh it (cross-tab safe), then let socket.io retry with the new one.
    if (AUTH_ERRORS.has(err.message)) {
      refreshAccessToken()
        .then(() => s.connect())
        .catch(() => {}) // definitive 401 signs the user out elsewhere
    }
  })
  socket = s
  return s
}

export function disconnectScanSocket() {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  setConnected(false)
}
