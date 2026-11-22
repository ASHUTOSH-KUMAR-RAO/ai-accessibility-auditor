import type { Request } from "express"
import * as scans from "../services/scan.service.js"
import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { sendSuccess } from "../utils/response.js"
import { createScanSchema, idParamSchema, listIssuesQuery, listScansQuery, ruleNodesQuery, ruleParamSchema } from "../validators/scan.schemas.js"

const userId = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  return req.user.id
}
const scanId = (req: Request) => idParamSchema.parse(req.params).id

export const create = asyncHandler(async (req, res) => {
  const scan = await scans.createScan(userId(req), createScanSchema.parse(req.body))
  sendSuccess(res, { scan }, "Scan queued", 202)
})

export const rescan = asyncHandler(async (req, res) => {
  sendSuccess(res, { scan: await scans.rescan(userId(req), scanId(req)) }, "Scan queued", 202)
})

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await scans.listScans(userId(req), listScansQuery.parse(req.query)))
})

export const stats = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, await scans.scanStats(userId(req)))
})

export const get = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { scan: await scans.getScan(userId(req), scanId(req)) })
})

export const report = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { report: await scans.getReport(userId(req), scanId(req)) })
})

export const ruleNodes = asyncHandler(async (req, res) => {
  const { id, ruleId } = ruleParamSchema.parse(req.params)
  sendSuccess(res, await scans.listRuleNodes(userId(req), id, ruleId, ruleNodesQuery.parse(req.query)))
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
