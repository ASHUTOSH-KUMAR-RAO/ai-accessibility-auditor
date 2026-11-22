import { findPublicUser, type PublicUser } from "../services/auth.service.js"
import { verifyAccessToken } from "../services/token.service.js"
import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

declare module "express-serve-static-core" {
  interface Request {
    user?: PublicUser
  }
}

/** Requires `Authorization: Bearer <access token>` and attaches req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")

  const user = await findPublicUser(verifyAccessToken(header.slice(7)))
  if (!user) throw new AppError("Invalid token", 401, "INVALID_TOKEN")

  req.user = user
  next()
})
