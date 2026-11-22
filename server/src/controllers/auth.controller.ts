import type { Response } from "express"
import * as auth from "../services/auth.service.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/AppError.js"
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from "../utils/cookies.js"
import { sendSuccess } from "../utils/response.js"

// Responses carry the access token in the body (kept in memory by the client);
// the refresh token only ever travels in the httpOnly cookie.
function respond(res: Response, s: auth.Session, message: string, status = 200) {
  setRefreshCookie(res, s.refreshToken, s.refreshExpiresAt)
  res.setHeader("Cache-Control", "no-store")
  return sendSuccess(res, { user: s.user, accessToken: s.accessToken }, message, status)
}

export const register = asyncHandler(async (req, res) => {
  respond(res, await auth.register(req.body), "Account created", 201)
})

export const login = asyncHandler(async (req, res) => {
  respond(res, await auth.login(req.body), "Signed in")
})

export const refresh = asyncHandler(async (req, res) => {
  try {
    respond(res, await auth.refresh(req.cookies?.[REFRESH_COOKIE]), "Session refreshed")
  } catch (err) {
    clearRefreshCookie(res)
    throw err
  }
})

export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE])
  clearRefreshCookie(res)
  sendSuccess(res, null, "Signed out")
})

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { user: req.user })
})
