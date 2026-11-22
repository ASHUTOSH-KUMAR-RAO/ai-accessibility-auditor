import { pingDb } from "../services/prisma.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/AppError.js"
import { sendSuccess } from "../utils/response.js"

export const getHealth = asyncHandler(async (_req, res) => {
  try {
    await pingDb()
  } catch {
    throw new AppError("Database is unreachable", 503, "DB_DOWN", { database: "down" })
  }
  sendSuccess(res, { status: "ok", database: "up", uptime: Math.round(process.uptime()) }, "Healthy")
})
