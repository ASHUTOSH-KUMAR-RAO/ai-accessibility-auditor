import { env } from "../config/env.js"
import type { Prisma } from "../generated/prisma/client.js"
import { AppError } from "../utils/AppError.js"
import { prisma } from "./prisma.js"
import { emitToUser } from "./realtime.js"
import { buildReport } from "./report/build-report.js"
import type { StoredPassed, StoredReview, StoredRule } from "./report/types.js"
import { publishScan, scanSelect, toScanDto } from "./scan-dto.js"
import { scanWorker } from "./scan-worker.js"
import { ScanError } from "./scanner/errors.js"
import { defaultGuard } from "./scanner/ssrf.js"

const ACTIVE = ["QUEUED", "RUNNING"] as const
const notFound = () => new AppError("Scan not found", 404, "NOT_FOUND")
/** Every read goes through this: a soft-deleted scan is gone for the user. */
const mine = (userId: string, id?: string): Prisma.ScanWhereInput => ({ userId, deletedAt: null, ...(id && { id }) })

export async function createScan(userId: string, input: { url: string; viewport: "DESKTOP" | "MOBILE" }) {
  let normalized: string
  try {
    const { url, normalized: n } = defaultGuard.normalize(input.url)
    defaultGuard.checkStatic(url) // instant feedback for localhost / IPs / odd ports; DNS is checked by the worker
    normalized = n
  } catch (err) {
    if (err instanceof ScanError) throw new AppError(err.message, 400, err.code)
    throw err
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const scan = await prisma.$transaction(async (tx) => {
    // Serialise per user so two simultaneous requests can't both slip under the limits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

    const active = await tx.scan.count({ where: { userId, status: { in: [...ACTIVE] } } })
    if (active >= env.SCAN_MAX_ACTIVE_PER_USER) {
      throw new AppError(`You already have ${active} scans in progress. Wait for one to finish or cancel it.`, 429, "TOO_MANY_ACTIVE")
    }
    // Deliberately NOT filtered by deletedAt: deleting a scan must not hand the hourly budget back.
    const recent = await tx.scan.count({ where: { userId, createdAt: { gte: hourAgo } } })
    if (recent >= env.SCAN_RATE_LIMIT_PER_HOUR) {
      throw new AppError(`You've reached the limit of ${env.SCAN_RATE_LIMIT_PER_HOUR} scans per hour. Please try again later.`, 429, "RATE_LIMITED")
    }
    return tx.scan.create({
      data: { userId, url: input.url.trim().slice(0, 2048), normalizedUrl: normalized, viewport: input.viewport },
      select: scanSelect,
    })
  })

  await publishScan(userId, "scan:queued", scan.id)
  scanWorker.kick()
  return toScanDto(scan)
}

/** Same URL and screen size as an existing scan, subject to the same limits. */
export async function rescan(userId: string, id: string) {
  const original = await prisma.scan.findFirst({ where: mine(userId, id), select: { url: true, viewport: true } })
  if (!original) throw notFound()
  return createScan(userId, original)
}

export interface ListQuery {
  limit: number
  cursor?: string
  status?: string
  viewport?: string
  q?: string
  minScore?: number
  maxScore?: number
  sort: "date" | "score"
  order: "asc" | "desc"
}

/** LIKE wildcards typed by the user (%, _) must match literally. */
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

export async function listScans(userId: string, q: ListQuery) {
  const term = q.q ? escapeLike(q.q) : undefined
  const where: Prisma.ScanWhereInput = {
    ...mine(userId),
    ...(q.status && { status: q.status as "QUEUED" }),
    ...(q.viewport && { viewport: q.viewport as "DESKTOP" }),
    ...(term && { OR: [{ normalizedUrl: { contains: term, mode: "insensitive" } }, { pageTitle: { contains: term, mode: "insensitive" } }] }),
  }
  const range = { ...(q.minScore !== undefined && { gte: q.minScore }), ...(q.maxScore !== undefined && { lte: q.maxScore }) }
  // Sorting or filtering by score only makes sense for scans that have one (also keeps keyset paging free of NULLs).
  if (q.sort === "score" || Object.keys(range).length) where.score = Object.keys(range).length ? range : { not: null }

  const rows = await prisma.scan.findMany({
    where,
    orderBy: q.sort === "score" ? [{ score: q.order }, { createdAt: "desc" }, { id: "desc" }] : [{ createdAt: q.order }, { id: q.order }],
    take: q.limit + 1,
    ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    select: scanSelect,
  })
  const page = rows.slice(0, q.limit)
  return { items: page.map(toScanDto), nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null }
}

export async function getScan(userId: string, id: string) {
  const scan = await prisma.scan.findFirst({ where: mine(userId, id), select: scanSelect })
  if (!scan) throw notFound()
  return toScanDto(scan)
}

export async function getReport(userId: string, id: string) {
  const scan = await prisma.scan.findFirst({
    where: mine(userId, id),
    select: {
      id: true, url: true, finalUrl: true, pageTitle: true, favicon: true, viewport: true, durationMs: true,
      createdAt: true, startedAt: true, completedAt: true, score: true, status: true,
      rules: true, reviewItems: true, passedRules: true,
      screenshot: { select: { width: true, height: true } },
    },
  })
  if (!scan) throw notFound()
  if (scan.status !== "COMPLETED") throw new AppError("This scan has no report yet.", 409, "NOT_COMPLETED")

  const issues = await prisma.issue.findMany({
    where: { scanId: id },
    select: { id: true, ruleId: true, impact: true, wcagTags: true, help: true, description: true, helpUrl: true, boundingBox: true, occurrenceIndex: true },
  })
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

  const { status: _status, rules, reviewItems, passedRules, screenshot, ...summary } = scan
  return buildReport({
    scan: { ...summary, score: scan.score ?? 0 },
    rules: Array.isArray(rules) ? (rules as StoredRule[]) : null, // null = scan predates per-rule totals
    issues,
    review: list<StoredReview>(reviewItems),
    passed: list<StoredPassed>(passedRules),
    screenshot,
  })
}

export async function listRuleNodes(userId: string, id: string, ruleId: string, q: { limit: number; cursor?: string }) {
  await getScan(userId, id) // ownership + not deleted
  const rows = await prisma.issue.findMany({
    where: { scanId: id, ruleId },
    orderBy: [{ occurrenceIndex: "asc" }, { id: "asc" }],
    take: q.limit + 1,
    ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    select: { id: true, selector: true, html: true, failureSummary: true, boundingBox: true, occurrenceIndex: true },
  })
  const page = rows.slice(0, q.limit)
  return { items: page, nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null }
}

export async function listIssues(userId: string, id: string, q: { limit: number; cursor?: string; impact?: string }) {
  await getScan(userId, id) // ownership check
  const rows = await prisma.issue.findMany({
    where: { scanId: id, ...(q.impact && { impact: q.impact as "CRITICAL" }) },
    orderBy: [{ impact: "asc" }, { ruleId: "asc" }, { occurrenceIndex: "asc" }, { id: "asc" }],
    take: q.limit + 1,
    ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    omit: { scanId: true },
  })
  const page = rows.slice(0, q.limit)
  return { items: page, nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null }
}

export async function getScreenshot(userId: string, id: string) {
  const shot = await prisma.scanScreenshot.findFirst({ where: { scanId: id, scan: { userId, deletedAt: null } }, select: { data: true, mime: true } })
  if (!shot) throw new AppError("Screenshot not found", 404, "NOT_FOUND")
  return { buffer: Buffer.from(shot.data), mime: shot.mime }
}

export async function cancelScan(userId: string, id: string) {
  const { count } = await prisma.scan.updateMany({
    where: { ...mine(userId, id), status: { in: [...ACTIVE] } },
    data: { status: "CANCELLED", completedAt: new Date(), stage: "Cancelled" },
  })
  if (count === 0) {
    await getScan(userId, id) // 404 if it isn't theirs
    throw new AppError("That scan has already finished.", 409, "ALREADY_FINISHED")
  }
  scanWorker.abort(id) // other instances notice through their heartbeat
  await publishScan(userId, "scan:cancelled", id)
  return getScan(userId, id)
}

/** Soft delete: hidden at once, purged later. The row keeps counting toward the hourly limit meanwhile. */
export async function deleteScan(userId: string, id: string) {
  const { count } = await prisma.scan.updateMany({ where: { ...mine(userId, id), status: { notIn: [...ACTIVE] } }, data: { deletedAt: new Date() } })
  if (count === 0) {
    await getScan(userId, id)
    throw new AppError("Cancel the scan before deleting it.", 409, "SCAN_ACTIVE")
  }
  emitToUser(userId, "scan:deleted", { id })
}

/** Hard-delete scans that were soft-deleted more than `olderThanDays` ago (their rows no longer matter for limits). */
export async function purgeDeletedScans(olderThanDays = 7) {
  const { count } = await prisma.scan.deleteMany({ where: { deletedAt: { lt: new Date(Date.now() - olderThanDays * 86_400_000) } } })
  return count
}

export async function scanStats(userId: string) {
  const [totalScans, completed, top] = await Promise.all([
    prisma.scan.count({ where: mine(userId) }),
    prisma.scan.aggregate({ where: { ...mine(userId), status: "COMPLETED" }, _avg: { score: true }, _count: true }),
    prisma.$queryRaw<Array<{ ruleId: string; help: string; scans: bigint }>>`
      SELECT i."ruleId", min(i."help") AS help, count(DISTINCT i."scanId") AS scans
      FROM "Issue" i JOIN "Scan" s ON s."id" = i."scanId"
      WHERE s."userId" = ${userId}::uuid AND s."deletedAt" IS NULL
      GROUP BY i."ruleId" ORDER BY scans DESC, i."ruleId" ASC LIMIT 1`,
  ])
  return {
    totalScans,
    completedScans: completed._count,
    averageScore: completed._avg.score === null ? null : Math.round(completed._avg.score),
    mostCommonIssue: top[0] ? { ruleId: top[0].ruleId, help: top[0].help, scans: Number(top[0].scans) } : null,
  }
}
