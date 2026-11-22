import type { Request } from "express"
import { z } from "zod"
import { compareScans, getSite, listSites } from "../services/compare/compare.service.js"
import { exportIssues, toCsv } from "../services/export/export.service.js"
import { getDashboard } from "../services/dashboard.service.js"
import { getReportPdf } from "../services/pdf/pdf.service.js"
import { prisma } from "../services/prisma.js"
import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { sendSuccess } from "../utils/response.js"
import { idParamSchema } from "../validators/scan.schemas.js"

const userId = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  return req.user.id
}
const id = (req: Request) => idParamSchema.parse(req.params).id

const compareQuery = z.object({ a: z.uuid(), b: z.uuid() })
const hostParam = z.object({ host: z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/i) })
const exportQuery = z.object({ rules: z.string().max(4000).optional() })

export const keyboard = asyncHandler(async (req, res) => {
  const scan = await prisma.scan.findFirst({ where: { id: id(req), userId: userId(req), deletedAt: null }, select: { tabOrder: true, status: true } })
  if (!scan) throw new AppError("Scan not found", 404, "NOT_FOUND")
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { available: scan.tabOrder !== null, tabOrder: scan.tabOrder })
})

export const compare = asyncHandler(async (req, res) => {
  const q = compareQuery.parse(req.query)
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, await compareScans(userId(req), q.a, q.b))
})

export const dashboard = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, await getDashboard(userId(req)))
})

export const sites = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { sites: await listSites(userId(req)) })
})

export const site = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, await getSite(userId(req), hostParam.parse(req.params).host.toLowerCase()))
})

const ruleList = (raw?: string) => (raw ? raw.split(",").map((r) => r.trim()).filter((r) => /^[a-zA-Z0-9._-]{1,100}$/.test(r)).slice(0, 200) : undefined)

function download(res: import("express").Response, name: string, type: string, body: string | Buffer) {
  res.setHeader("Content-Type", type)
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "no-store")
  res.send(body)
}

export const exportCsv = asyncHandler(async (req, res) => {
  const { scan, rows } = await exportIssues(userId(req), id(req), ruleList(exportQuery.parse(req.query).rules))
  download(res, `accesslens-issues-${scan.id.slice(0, 8)}.csv`, "text/csv; charset=utf-8", toCsv(rows))
})

export const exportJson = asyncHandler(async (req, res) => {
  const { scan, rows } = await exportIssues(userId(req), id(req), ruleList(exportQuery.parse(req.query).rules))
  const body = { tool: "AccessLens", scan: { url: scan.finalUrl ?? scan.url, title: scan.pageTitle, score: scan.score, viewport: scan.viewport, scannedAt: scan.completedAt }, count: rows.length, issues: rows }
  download(res, `accesslens-issues-${scan.id.slice(0, 8)}.json`, "application/json; charset=utf-8", JSON.stringify(body, null, 2))
})

export const reportPdf = asyncHandler(async (req, res) => {
  const { pdf, filename, cached } = await getReportPdf(userId(req), id(req))
  res.setHeader("X-Pdf-Cached", String(cached))
  download(res, filename, "application/pdf", pdf)
})
