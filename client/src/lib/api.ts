import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { session } from "@/lib/session"

/** Shape every server response follows: { success, message, data, error } */
export interface ApiEnvelope<T = unknown> {
  success: boolean
  message: string
  data: T | null
  error: { code: string; details?: unknown } | null
}

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly details?: unknown

  constructor(message: string, status: number | null, code: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }

  get isNetwork() {
    return this.code === "NETWORK" || this.code === "TIMEOUT"
  }
}

export const api = axios.create({
  // Same-origin by default: Vite proxies /api in dev, a Vercel rewrite does in production,
  // so the refresh cookie is always first-party.
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
})

api.interceptors.request.use((config) => {
  const token = session.getToken()
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

function toApiError(err: AxiosError<ApiEnvelope>): ApiError {
  if (err.response) {
    const body = err.response.data
    return new ApiError(body?.message ?? "Something went wrong on our side.", err.response.status, body?.error?.code ?? "SERVER_ERROR", body?.error?.details)
  }
  if (err.code === "ECONNABORTED") return new ApiError("The server took too long to respond. Please try again.", null, "TIMEOUT")
  return new ApiError("Can't reach the server. Check your connection and try again.", null, "NETWORK")
}

// ───────────── Token refresh: single-flight per tab + cross-tab lock ─────────────
// Refresh tokens are single-use. If two tabs rotated at the same moment, one would replay a
// consumed token and the server would (correctly) revoke the whole session. The Web Lock
// serialises refreshes across tabs; the shared promise dedupes them inside one tab.

interface RefreshResult { accessToken: string }
let inflight: Promise<string> | null = null

const withTabLock = <T>(fn: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("accesslens:refresh", fn) : fn()

export function refreshAccessToken(): Promise<string> {
  inflight ??= withTabLock(async () => {
    const res = await api.post<ApiEnvelope<RefreshResult>>("/auth/refresh")
    const token = res.data.data!.accessToken
    session.setToken(token)
    return token
  })
    .catch((err: unknown) => {
      // Only a definitive "your session is gone" signs the user out; network blips don't.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) session.clear()
      throw err
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"]
type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiEnvelope>) => {
    const config = err.config as RetryableConfig | undefined
    const isAuthCall = AUTH_ENDPOINTS.some((p) => config?.url?.startsWith(p))

    if (err.response?.status === 401 && config && !config._retried && !isAuthCall && session.hasSession()) {
      config._retried = true
      await refreshAccessToken() // throws ApiError (and signs out) if the session is really gone
      config.headers.Authorization = `Bearer ${session.getToken()}`
      return api(config)
    }
    return Promise.reject(err instanceof ApiError ? err : toApiError(err))
  },
)

/** Unwraps the envelope and returns `data`. */
export async function get<T>(url: string): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(url)
  return res.data.data as T
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<ApiEnvelope<T>>(url, body)
  return res.data.data as T
}
