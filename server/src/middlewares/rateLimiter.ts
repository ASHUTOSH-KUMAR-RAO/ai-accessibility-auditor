import { rateLimit } from "express-rate-limit"
import { sendError } from "../utils/response.js"

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => void sendError(res, 429, "Too many requests. Please slow down and try again shortly.", "RATE_LIMITED"),
})
