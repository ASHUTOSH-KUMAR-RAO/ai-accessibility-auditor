import { rateLimit } from "express-rate-limit"
import { sendError } from "../utils/response.js"

const handler = (message: string) => (_req: unknown, res: Parameters<typeof sendError>[0]) =>
  void sendError(res, 429, message, "RATE_LIMITED")

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many requests. Please slow down and try again shortly."),
})

/** Brute-force / signup-spam protection. Successful logins don't count against the budget. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many sign-in attempts. Try again in 15 minutes."),
})

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many accounts created from this network. Try again later."),
})

