import type { Response } from "express"

export interface ApiEnvelope<T = unknown> {
  success: boolean
  message: string
  data: T | null
  error: { code: string; details?: unknown } | null
}

export function sendSuccess<T>(res: Response, data: T, message = "OK", status = 200) {
  const body: ApiEnvelope<T> = { success: true, message, data, error: null }
  return res.status(status).json(body)
}

export function sendError(res: Response, status: number, message: string, code: string, details?: unknown) {
  const body: ApiEnvelope = { success: false, message, data: null, error: { code, ...(details !== undefined && { details }) } }
  return res.status(status).json(body)
}
