import type { Request, RequestHandler } from "express"
import { z } from "zod"
import { loadIssueForScan } from "../services/ai/ai.service.js"
import { peekFix } from "../services/ai/fix.service.js"
import { getSummaryForScan } from "../services/ai/summary.service.js"
import { prisma } from "../services/prisma.js"
import { nodesForScan, reportForScan, screenshotForScan } from "../services/scan.service.js"
import { gradeFor } from "../services/report/grade.js"
import { badgeSvg } from "../services/share/badge.js"
import { createShare, listShares, resolveShare, revokeShare, type Expiry } from "../services/share/share.service.js"
import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { sendSuccess } from "../utils/response.js"
import { idParamSchema, ruleNodesQuery } from "../validators/scan.schemas.js"

const userId = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  return req.user.id
}

// ───────── owner ─────────
const createBody = z.object({ expiry: z.enum(["24h", "7d", "30d", "never"]).default("7d"), hideScreenshot: z.boolean().default(false) })
const shareParams = z.object({ id: z.uuid(), shareId: z.uuid() })

export const create = asyncHandler(async (req, res) => {
  const body = createBody.parse(req.body ?? {})
  const { share, token } = await createShare(userId(req), idParamSchema.parse(req.params).id, { expiry: body.expiry as Expiry, hideScreenshot: body.hideScreenshot })
  res.setHeader("Cache-Control", "no-store")
  // The token is in this response only. It cannot be recovered later: only its hash is stored.
  sendSuccess(res, { share, token, path: `/r/${token}`, badgePath: `/api/badge/${token}.svg` }, "Link created", 201)
})

export const list = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { shares: await listShares(userId(req), idParamSchema.parse(req.params).id) })
})

export const revoke = asyncHandler(async (req, res) => {
  const p = shareParams.parse(req.params)
  await revokeShare(userId(req), p.id, p.shareId)
  sendSuccess(res, null, "Link revoked")
})

// ───────── public (no login) ─────────
const token = (req: Request) => z.string().max(80).parse(req.params.token)
const withShare = (fn: (share: Awaited<ReturnType<typeof resolveShare>>, req: Request) => Promise<unknown>, countView = false): RequestHandler =>
  asyncHandler(async (req, res) => {
    const share = await resolveShare(token(req), { countView })
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive")
    res.setHeader("Referrer-Policy", "no-referrer")
    sendSuccess(res, await fn(share, req))
  })

export const publicReport = withShare(async (share) => {
  const report = await reportForScan(share.scanId)
  // No scan id, no owner: only what the report page itself shows.
  const scan = { ...report.scan, id: "shared" }
  return {
    report: share.hideScreenshot ? { ...report, scan, screenshot: null, markers: [] } : { ...report, scan },
    share: { expiresAt: share.expiresAt, hideScreenshot: share.hideScreenshot },
  }
}, true)

export const publicNodes = withShare((share, req) => {
  const ruleId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/).parse(req.params.ruleId)
  return nodesForScan(share.scanId, ruleId, ruleNodesQuery.parse(req.query))
})

export const publicSummary = withShare(async (share) => ({ summary: await getSummaryForScan(share.scanId) }))

export const publicKeyboard = withShare(async (share) => {
  const scan = await prisma.scan.findUnique({ where: { id: share.scanId }, select: { tabOrder: true } })
  return { available: scan?.tabOrder != null, tabOrder: scan?.tabOrder ?? null }
})

/** A saved fix only. A public link can never trigger an AI call. */
export const publicFix = withShare(async (share, req) => {
  const issue = await loadIssueForScan(share.scanId, z.uuid().parse(req.params.issueId))
  const fix = await peekFix(issue)
  if (!fix) throw new AppError("No AI fix has been saved for this element.", 404, "NO_SAVED_FIX")
  return { fix }
})

export const publicScreenshot: RequestHandler = asyncHandler(async (req, res) => {
  const share = await resolveShare(token(req))
  if (share.hideScreenshot) throw new AppError("This link is invalid or has expired.", 404, "LINK_NOT_FOUND")
  const { buffer, mime } = await screenshotForScan(share.scanId)
  res.setHeader("Content-Type", mime)
  res.setHeader("Cache-Control", "private, max-age=300")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Robots-Tag", "noindex")
  res.send(buffer)
})

/** Embeddable score badge. Live only while the share link is active; otherwise a grey "unavailable" badge (404). */
export const badge: RequestHandler = asyncHandler(async (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Robots-Tag", "noindex")
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
  try {
    const share = await resolveShare(z.string().max(80).parse(req.params.token))
    const scan = await prisma.scan.findUnique({ where: { id: share.scanId }, select: { score: true } })
    res.setHeader("Cache-Control", "public, max-age=300")
    res.send(badgeSvg(scan?.score ?? null, scan?.score == null ? null : gradeFor(scan.score)))
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    res.setHeader("Cache-Control", "public, max-age=60")
    res.status(404).send(badgeSvg(null, null))
  }
})
