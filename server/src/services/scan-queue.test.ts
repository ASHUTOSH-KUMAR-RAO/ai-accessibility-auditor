// Needs the local Postgres. STOP the dev server first: its worker would race these tests for QUEUED scans.
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import "../config/env.js"
import { prisma } from "./prisma.js"
import { ScanQueue, type ClaimedScan } from "./scan-queue.js"

const email = `queue-${Date.now()}@example.com`
let userId: string

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const waitFor = async (cond: () => Promise<boolean> | boolean, ms = 10_000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await cond()) return
    await sleep(25)
  }
  throw new Error("waitFor timed out")
}
const mk = (n = 1, data: object = {}) =>
  Promise.all(Array.from({ length: n }, (_, i) => prisma.scan.create({ data: { userId, url: `https://example.com/${i}`, normalizedUrl: `https://example.com/${i}`, ...data } })))
const status = async (id: string) => (await prisma.scan.findUniqueOrThrow({ where: { id } })).status

before(async () => {
  userId = (await prisma.user.create({ data: { name: "Queue Test", email, password: "x" } })).id
  const foreign = await prisma.scan.count({ where: { status: { in: ["QUEUED", "RUNNING"] }, NOT: { userId } } })
  assert.equal(foreign, 0, "other QUEUED/RUNNING scans exist (is the dev server running?): refusing to run, it would consume them")
})
after(async () => {
  await prisma.user.deleteMany({ where: { email } })
  await prisma.$disconnect()
})

const finish = (scan: ClaimedScan) => prisma.scan.updateMany({ where: { id: scan.id, status: "RUNNING" }, data: { status: "COMPLETED", progress: 100, completedAt: new Date() } })
const fast = { pollMs: 40, heartbeatMs: 40 }

describe("ScanQueue", { timeout: 60_000 }, () => {
  it("never runs more than `concurrency` scans at once, and finishes them all", async () => {
    const scans = await mk(7)
    let cur = 0
    let max = 0
    const q = new ScanQueue({
      concurrency: 2,
      ...fast,
      run: async (s) => {
        cur++
        max = Math.max(max, cur)
        await sleep(200)
        await finish(s)
        cur--
      },
    })
    await q.start()
    await waitFor(async () => (await prisma.scan.count({ where: { userId, status: "COMPLETED" } })) === 7)
    await q.stop(1000)
    assert.equal(max, 2)
    assert.equal(scans.length, 7)
  })

  it("does not process a scan twice when two workers share the database (SKIP LOCKED)", async () => {
    await mk(10)
    const seen = new Map<string, number>()
    const run = async (s: ClaimedScan) => {
      seen.set(s.id, (seen.get(s.id) ?? 0) + 1)
      await sleep(60)
      await finish(s)
    }
    const a = new ScanQueue({ concurrency: 3, ...fast, run })
    const b = new ScanQueue({ concurrency: 3, ...fast, run })
    await Promise.all([a.start(), b.start()])
    await waitFor(async () => (await prisma.scan.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } })) === 0)
    await Promise.all([a.stop(1000), b.stop(1000)])
    assert.equal(seen.size, 10)
    assert.ok([...seen.values()].every((n) => n === 1), "every scan ran exactly once")
  })

  it("a cancelled QUEUED scan is never started", async () => {
    const [scan] = await mk(1)
    await prisma.scan.update({ where: { id: scan!.id }, data: { status: "CANCELLED" } })
    let ran = false
    const q = new ScanQueue({ concurrency: 2, ...fast, run: async () => void (ran = true) })
    await q.start()
    await sleep(300)
    await q.stop(500)
    assert.equal(ran, false)
    assert.equal(await status(scan!.id), "CANCELLED")
  })

  it("cancelling a RUNNING scan (from the DB, as another instance would) aborts the runner", async () => {
    const [scan] = await mk(1)
    let abortedWith: unknown = null
    let started!: () => void
    const startedP = new Promise<void>((r) => (started = r))
    const q = new ScanQueue({
      concurrency: 1,
      ...fast,
      run: async (_s, signal) => {
        started()
        await new Promise<void>((r) => signal.addEventListener("abort", () => r(), { once: true }))
        abortedWith = signal.reason
      },
    })
    await q.start()
    await startedP
    await prisma.scan.update({ where: { id: scan!.id }, data: { status: "CANCELLED", completedAt: new Date() } })
    await waitFor(() => abortedWith !== null)
    await q.stop(500)
    assert.equal(abortedWith, "cancelled")
    assert.equal(await status(scan!.id), "CANCELLED")
  })

  it("abort(id) cancels a scan this instance is running", async () => {
    const [scan] = await mk(1)
    let reason: unknown = null
    const q = new ScanQueue({ concurrency: 1, ...fast, run: (_s, signal) => new Promise<void>((r) => signal.addEventListener("abort", () => ((reason = signal.reason), r()))) })
    await q.start()
    await waitFor(async () => (await status(scan!.id)) === "RUNNING")
    q.abort(scan!.id)
    await waitFor(() => reason !== null)
    await q.stop(500)
    assert.equal(reason, "cancelled")
  })

  it("recovers scans orphaned by a crash: re-queue first, fail after repeated attempts, leave live ones alone", async () => {
    const old = new Date(Date.now() - 5 * 60_000)
    const [orphan, exhausted, alive] = await Promise.all([
      prisma.scan.create({ data: { userId, url: "https://a.example", normalizedUrl: "https://a.example/", status: "RUNNING", attempts: 1, heartbeatAt: old, startedAt: old, progress: 50 } }),
      prisma.scan.create({ data: { userId, url: "https://b.example", normalizedUrl: "https://b.example/", status: "RUNNING", attempts: 2, heartbeatAt: old, startedAt: old } }),
      prisma.scan.create({ data: { userId, url: "https://c.example", normalizedUrl: "https://c.example/", status: "RUNNING", attempts: 1, heartbeatAt: new Date(), startedAt: new Date() } }),
    ])
    const failed: string[] = []
    const q = new ScanQueue({ concurrency: 1, ...fast, staleMs: 30_000, maxAttempts: 2, run: async () => {}, onRecoveredFailure: (s) => failed.push(s.id) })
    await q.recoverStale() // not started: only the recovery logic runs
    const o = await prisma.scan.findUniqueOrThrow({ where: { id: orphan.id } })
    assert.equal(o.status, "QUEUED")
    assert.equal(o.progress, 0)
    const e = await prisma.scan.findUniqueOrThrow({ where: { id: exhausted.id } })
    assert.equal(e.status, "FAILED")
    assert.equal(e.errorCode, "SCAN_FAILED")
    assert.deepEqual(failed, [exhausted.id])
    assert.equal(await status(alive.id), "RUNNING")
    await prisma.scan.deleteMany({ where: { id: { in: [orphan.id, exhausted.id, alive.id] } } })
  })

  it("a stopping queue hands its running scan back (shutdown aborts with reason 'shutdown')", async () => {
    const [scan] = await mk(1)
    let reason: unknown = null
    const q = new ScanQueue({ concurrency: 1, ...fast, run: (_s, signal) => new Promise<void>((r) => signal.addEventListener("abort", () => ((reason = signal.reason), r()))) })
    await q.start()
    await waitFor(async () => (await status(scan!.id)) === "RUNNING")
    await q.stop(200)
    assert.equal(reason, "shutdown")
  })
})
