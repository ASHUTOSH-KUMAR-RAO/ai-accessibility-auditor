import { createHash, randomUUID } from "node:crypto"
import jwt from "jsonwebtoken"
import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"

const ALG = ["HS256"] as const

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

export function signAccessToken(userId: string) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, { algorithm: "HS256", subject: userId, expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"] })
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [...ALG] })
    if (typeof payload === "string" || !payload.sub) throw new Error("no subject")
    return payload.sub
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError
    throw new AppError(expired ? "Session expired" : "Invalid token", 401, expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN")
  }
}

/** Refresh tokens are signed JWTs with a unique jti so every issued token (and hash) is distinct. */
export function signRefreshToken(userId: string) {
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    subject: userId,
    jwtid: randomUUID(),
    expiresIn: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60,
  })
  return { token, expiresAt }
}

/** Returns the user id if the signature and expiry are valid, otherwise null. */
export function verifyRefreshToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [...ALG] })
    return typeof payload === "string" ? null : (payload.sub ?? null)
  } catch {
    return null
  }
}
