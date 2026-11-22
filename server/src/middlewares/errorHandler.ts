import type { ErrorRequestHandler, RequestHandler } from "express"
import { ZodError } from "zod"
import { isProd } from "../config/env.js"
import { AppError } from "../utils/AppError.js"
import { logger } from "../utils/logger.js"
import { sendError } from "../utils/response.js"

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.path}`, "NOT_FOUND")
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof AppError) return void sendError(res, err.statusCode, err.message, err.code, err.details)
  if (err instanceof ZodError) return void sendError(res, 400, "Validation failed", "VALIDATION_ERROR", err.issues)
  if (err?.type === "entity.parse.failed") return void sendError(res, 400, "Request body is not valid JSON", "BAD_JSON")
  if (err?.type === "entity.too.large") return void sendError(res, 413, "Request body is too large", "PAYLOAD_TOO_LARGE")

  logger.error("Unhandled error", { err, method: req.method, path: req.path })
  sendError(res, 500, isProd ? "Something went wrong on our side." : String(err?.message ?? err), "INTERNAL_ERROR")
}
