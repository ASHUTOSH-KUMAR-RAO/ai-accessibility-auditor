import { logger } from "../utils/logger.js"
import { prisma } from "./prisma.js"
import { SCAN_ERROR_MESSAGES } from "./scanner/errors.js"

export interface ClaimedScan {
  id: string
  userId: string
  url: string
  normalizedUrl: string
  viewport: "DESKTOP" | "MOBILE"
}

export interface QueueOptions {
  concurrency: number
  /** Does the actual work. Must never throw for expected outcomes (it owns status updates). */
  run: (scan: ClaimedScan, signal: AbortSignal) => Promise<void>
  pollMs?: number
  heartbeatMs?: number
  /** A RUNNING scan with no heartbeat for this long is considered orphaned by a crash. */
  staleMs?: number
  /** Attempts before an orphaned scan is failed instead of re-queued. */
  maxAttempts?: number
  onRecoveredFailure?: (scan: { id: string; userId: string }) => void
}

/**
 * Database-backed queue (no Redis). Safe with several instances: jobs are claimed with
 * `FOR UPDATE SKIP LOCKED`, liveness is a heartbeat column, cancel is a status flip every worker observes.
 */
export class ScanQueue {
  private readonly active = new Map<string, AbortController>()
  private timer: NodeJS.Timeout | null = null
  private started = false
  private stopping = false
  private pumping = false
  private pumpAgain = false
  private lastRecovery = 0
  private readonly o: Required<Omit<QueueOptions, "onRecoveredFailure">> & Pick<QueueOptions, "onRecoveredFailure">

  constructor(options: QueueOptions) {
    this.o = { pollMs: 2000, heartbeatMs: 3000, staleMs: 30_000, maxAttempts: 2, ...options }
  }

  get activeCount() {
    return this.active.size
  }

  async start() {
    this.stopping = false
    this.started = true
    await this.recoverStale()
    this.timer = setInterval(() => {
      void this.pump()
      if (Date.now() - this.lastRecovery > this.o.staleMs) void this.recoverStale()
    }, this.o.pollMs)
    this.timer.unref()
    void this.pump()
  }

  /** Nudge the worker right after a scan is created instead of waiting for the next poll. */
  kick() {
    void this.pump()
  }

  /** Abort a scan this instance is running (other instances notice via the heartbeat). */
  abort(scanId: string) {
    this.active.get(scanId)?.abort("cancelled")
  }

  /** Stop claiming; give running scans `graceMs` to finish, then abort them ("shutdown" → they are re-queued). */
  async stop(graceMs = 10_000) {
    this.stopping = true
    if (this.timer) clearInterval(this.timer)
    const deadline = Date.now() + graceMs
    while (this.active.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    for (const ac of this.active.values()) ac.abort("shutdown")
    while (this.active.size > 0 && Date.now() < deadline + 5000) await new Promise((r) => setTimeout(r, 50))
  }

  private async pump() {
    if (this.stopping || !this.started) return // kick() before start() (e.g. API-only instance / tests) must not run scans
    if (this.pumping) {
      this.pumpAgain = true
      return
    }
    this.pumping = true
    try {
      do {
        this.pumpAgain = false
        while (!this.stopping && this.active.size < this.o.concurrency) {
          const scan = await this.claimNext()
          if (!scan) break
          this.launch(scan)
        }
      } while (this.pumpAgain && !this.stopping)
    } catch (err) {
      logger.error("Queue pump failed", { err })
    } finally {
      this.pumping = false
    }
  }

  private launch(scan: ClaimedScan) {
    const ac = new AbortController()
    this.active.set(scan.id, ac)
    const beat = setInterval(() => void this.heartbeat(scan.id, ac), this.o.heartbeatMs)
    this.o
      .run(scan, ac.signal)
      .catch((err) => logger.error("Scan runner crashed", { err, scanId: scan.id }))
      .finally(() => {
        clearInterval(beat)
        this.active.delete(scan.id)
        void this.pump()
      })
  }

  private async heartbeat(id: string, ac: AbortController) {
    try {
      const { count } = await prisma.scan.updateMany({ where: { id, status: "RUNNING" }, data: { heartbeatAt: new Date() } })
      if (count === 0) ac.abort("cancelled") // cancelled (maybe from another instance) or deleted
    } catch (err) {
      logger.warn("Heartbeat failed", { err, scanId: id })
    }
  }

  /** Atomically takes the oldest QUEUED scan. SKIP LOCKED lets parallel workers pass over each other's picks. */
  private async claimNext(): Promise<ClaimedScan | null> {
    const rows = await prisma.$queryRaw<ClaimedScan[]>`
      UPDATE "Scan"
      SET "status" = 'RUNNING', "startedAt" = now(), "heartbeatAt" = now(),
          "attempts" = "attempts" + 1, "progress" = 2, "stage" = 'Checking URL'
      WHERE "id" = (
        SELECT "id" FROM "Scan" WHERE "status" = 'QUEUED'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "userId", "url", "normalizedUrl", "viewport"::text AS "viewport"`
    return rows[0] ?? null
  }

  /** RUNNING scans whose worker vanished: re-queue them, or fail them after too many attempts. */
  async recoverStale() {
    this.lastRecovery = Date.now()
    const cutoff = new Date(Date.now() - this.o.staleMs)
    const stale = await prisma.scan.findMany({
      where: { status: "RUNNING", OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: cutoff } }] },
      select: { id: true, userId: true, attempts: true },
    })
    for (const s of stale) {
      if (this.active.has(s.id)) continue // ours and alive
      if (s.attempts < this.o.maxAttempts) {
        const { count } = await prisma.scan.updateMany({
          where: { id: s.id, status: "RUNNING" },
          data: { status: "QUEUED", progress: 0, stage: null, startedAt: null, heartbeatAt: null },
        })
        if (count) logger.warn("Re-queued orphaned scan", { scanId: s.id })
      } else {
        const { count } = await prisma.scan.updateMany({
          where: { id: s.id, status: "RUNNING" },
          data: { status: "FAILED", errorCode: "SCAN_FAILED", errorMessage: SCAN_ERROR_MESSAGES.SCAN_FAILED, completedAt: new Date() },
        })
        if (count) {
          logger.warn("Failed orphaned scan after repeated attempts", { scanId: s.id })
          this.o.onRecoveredFailure?.({ id: s.id, userId: s.userId })
        }
      }
    }
    if (stale.length) void this.pump()
  }
}
