import axios, { AxiosError } from "axios"

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
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  timeout: 15_000,
  headers: { Accept: "application/json" },
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiEnvelope>) => {
    if (err.response) {
      const body = err.response.data
      return Promise.reject(
        new ApiError(
          body?.message ?? "Something went wrong on our side.",
          err.response.status,
          body?.error?.code ?? "SERVER_ERROR",
          body?.error?.details,
        ),
      )
    }
    if (err.code === "ECONNABORTED") {
      return Promise.reject(new ApiError("The server took too long to respond. Please try again.", null, "TIMEOUT"))
    }
    return Promise.reject(new ApiError("Can't reach the server. Check your connection and try again.", null, "NETWORK"))
  },
)

/** Unwraps the envelope and returns `data`. */
export async function get<T>(url: string): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(url)
  return res.data.data as T
}
