import type { RequestHandler } from "express"
import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"

const originOf = (value: string | undefined) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * CSRF defence for cookie-authenticated endpoints. Browsers always send Origin on
 * cross-origin and same-origin POSTs, so: Origin (or Referer fallback) must be an allowed client origin.
 * Requests with neither header are non-browser clients (curl, server-to-server), which cannot be CSRF'd.
 */
export const originCheck: RequestHandler = (req, _res, next) => {
  const origin = originOf(req.headers.origin) ?? originOf(req.headers.referer)
  if (origin && !env.CLIENT_URL.includes(origin)) throw new AppError("Origin not allowed", 403, "BAD_ORIGIN")
  next()
}
