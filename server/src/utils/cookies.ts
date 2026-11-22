import type { CookieOptions, Response } from "express"
import { env, isProd } from "../config/env.js"

export const REFRESH_COOKIE = "refresh_token"

// Scoped to /api/auth so the cookie is never sent with ordinary API calls.
const base = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd || env.COOKIE_SAMESITE === "none",
  sameSite: env.COOKIE_SAMESITE,
  path: "/api/auth",
})

export const setRefreshCookie = (res: Response, token: string, expiresAt: Date) =>
  res.cookie(REFRESH_COOKIE, token, { ...base(), expires: expiresAt })

export const clearRefreshCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, base())
