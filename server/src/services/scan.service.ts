import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"
import { prisma } from "./prisma.js"
import { publishScan, scanSelect, toScanDto } from "./scan-dto.js"
import { scanWorker } from "./scan-worker.js"
import { ScanError } from "./scanner/errors.js"
import { defaultGuard } from "./scanner/ssrf.js"

const ACTIVE = ["QUEUED", "RUNNING"] as const
const notFound = () => new AppError("Scan not found", 404, "NOT_FOUND")

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

export async function listScans(userId: string, q: { limit: number; cursor?: string; status?: string }) {
  const rows = await prisma.scan.findMany({
    where: { userId, ...(q.status && { status: q.status as "QUEUED" }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    select: scanSelect,
  })
  const page = rows.slice(0, q.limit)
  return { items: page.map(toScanDto), nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null }
}

export async function getScan(userId: string, id: string) {
  const scan = await prisma.scan.findFirst({ where: { id, userId }, select: scanSelect })
  if (!scan) throw notFound()
  return toScanDto(scan)
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
  const shot = await prisma.scanScreenshot.findFirst({ where: { scanId: id, scan: { userId } }, select: { data: true, mime: true } })
  if (!shot) throw new AppError("Screenshot not found", 404, "NOT_FOUND")
  return { buffer: Buffer.from(shot.data), mime: shot.mime }
}

export async function cancelScan(userId: string, id: string) {
  const { count } = await prisma.scan.updateMany({
    where: { id, userId, status: { in: [...ACTIVE] } },
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

export async function deleteScan(userId: string, id: string) {
  const { count } = await prisma.scan.deleteMany({ where: { id, userId, status: { notIn: [...ACTIVE] } } })
  if (count === 0) {
    await getScan(userId, id)
    throw new AppError("Cancel the scan before deleting it.", 409, "SCAN_ACTIVE")
  }
}
