import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { sendSuccess } from "../utils/response.js"
import * as scans from "../services/scan.service.js"
import { createScanSchema, idParamSchema, listIssuesQuery, listScansQuery } from "../validators/scan.schemas.js"
import type { Request } from "express"

const userId = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  return req.user.id
}
const scanId = (req: Request) => idParamSchema.parse(req.params).id

export const create = asyncHandler(async (req, res) => {
  const scan = await scans.createScan(userId(req), createScanSchema.parse(req.body))
  sendSuccess(res, { scan }, "Scan queued", 202)
})

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await scans.listScans(userId(req), listScansQuery.parse(req.query)))
})

export const get = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { scan: await scans.getScan(userId(req), scanId(req)) })
})

export const issues = asyncHandler(async (req, res) => {
  sendSuccess(res, await scans.listIssues(userId(req), scanId(req), listIssuesQuery.parse(req.query)))
})

export const screenshot = asyncHandler(async (req, res) => {
  const { buffer, mime } = await scans.getScreenshot(userId(req), scanId(req))
  res.setHeader("Content-Type", mime)
  res.setHeader("Cache-Control", "private, max-age=86400")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.send(buffer)
})

export const cancel = asyncHandler(async (req, res) => {
  sendSuccess(res, { scan: await scans.cancelScan(userId(req), scanId(req)) }, "Scan cancelled")
})

export const remove = asyncHandler(async (req, res) => {
  await scans.deleteScan(userId(req), scanId(req))
  sendSuccess(res, null, "Scan deleted")
})
