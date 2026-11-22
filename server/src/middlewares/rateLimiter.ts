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

/** Public share links and badges: anonymous, so limited per IP. */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many requests. Please try again in a few minutes."),
})
export const badgeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many requests."),
})
/** PDF generation is the heaviest request: per signed-in user. */
export const pdfLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as { user?: { id: string } }).user?.id ?? "anon",
  validate: { keyGeneratorIpFallback: false },
  handler: handler("You've created a lot of PDFs. Please try again later."),
})

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("Too many accounts created from this network. Try again later."),
})

