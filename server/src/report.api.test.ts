// Report, history, soft delete and rescan at the API level (needs the local Postgres; the worker is not started).
import assert from "node:assert/strict"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./services/prisma.js"
import { purgeDeletedScans } from "./services/scan.service.js"

const stamp = Date.now()
const emails = [`rep-a-${stamp}@example.com`, `rep-b-${stamp}@example.com`]
let server: Server
let base: string
let A: { token: string; id: string }
let B: { token: string; id: string }

const call = (path: string, token?: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: env.CLIENT_URL[0]!, ...(token && { Authorization: `Bearer ${token}` }) } })
const json = async (path: string, token = A.token, init: RequestInit = {}) => { const r = await call(path, token, init); const j = await r.json(); if (!j.success) console.log("API-ERR", path, r.status, JSON.stringify(j).slice(0, 300)); return j }
const post = (path: string, token: string, body: unknown = {}) => call(path, token, { method: "POST", body: JSON.stringify(body) })

async function signUp(email: string) {
  const { data } = await (await call("/auth/register", undefined, { method: "POST", body: JSON.stringify({ name: "Rep Test", email, password: "Sup3rSecret99" }) })).json()
  return { token: data.accessToken as string, id: data.user.id as string }
}

const RULES = [
  { id: "image-alt", impact: "critical", help: "Images must have alternate text", description: "d", helpUrl: "https://x/image-alt", tags: ["cat.text-alternatives", "wcag2a", "wcag111"], totalNodes: 80, storedNodes: 3 },
  { id: "color-contrast", impact: "serious", help: "Elements must meet minimum color contrast", description: "d", helpUrl: "https://x/cc", tags: ["cat.color", "wcag2aa", "wcag143"], totalNodes: 12, storedNodes: 1 },
  { id: "region", impact: "moderate", help: "All page content should be contained by landmarks", description: "d", helpUrl: "https://x/region", tags: ["cat.keyboard", "best-practice"], totalNodes: 4, storedNodes: 1 },
]

/** A completed scan with a full report payload. */
async function seedCompleted(userId: string, over: Record<string, unknown> = {}) {
  const scan = await prisma.scan.create({
    data: {
      userId, url: "https://shop.example.com/", normalizedUrl: "https://shop.example.com/", status: "COMPLETED", progress: 100, score: 64, pageTitle: "Example Shop",
      criticalCount: 80, seriousCount: 12, moderateCount: 4, passesCount: 30, incompleteCount: 1, finalUrl: "https://shop.example.com/", completedAt: new Date(),
      rules: RULES, reviewItems: [{ id: "color-contrast", impact: "serious", help: "h", description: "d", helpUrl: "u", tags: ["wcag2aa", "wcag143"], totalNodes: 1, nodes: [{ selector: "p", html: "<p>", message: "bg image" }] }],
      passedRules: [{ id: "document-title", help: "Documents must have <title>", tags: ["wcag2a", "wcag242"] }], ...over,
    },
  })
  const mk = (ruleId: string, impact: "CRITICAL" | "SERIOUS" | "MODERATE", i: number, box: boolean) => ({
    scanId: scan.id, ruleId, impact, wcagTags: ["wcag2a"], wcagCriteria: ["1.1.1"], help: `${ruleId} help`, description: "d", helpUrl: "u",
    selector: `.n${i}`, html: "<img>", failureSummary: "Fix any of the following:\n  Element does not have an alt attribute", occurrenceIndex: i,
    boundingBox: box ? { x: 10, y: 20 * i, width: 100, height: 50 } : undefined,
  })
  await prisma.issue.createMany({ data: [mk("image-alt", "CRITICAL", 0, true), mk("image-alt", "CRITICAL", 1, true), mk("image-alt", "CRITICAL", 2, false), mk("color-contrast", "SERIOUS", 0, true), mk("region", "MODERATE", 0, true)] })
  await prisma.scanScreenshot.create({ data: { scanId: scan.id, data: Buffer.from([0xff, 0xd8, 0xff]), mime: "image/jpeg", width: 1280, height: 900, bytes: 3 } })
  return scan.id
}

before(async () => {
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  ;[A, B] = (await Promise.all(emails.map(signUp))) as [typeof A, typeof B]
})
after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.$disconnect()
  server.close()
})
const clearA = () => prisma.scan.deleteMany({ where: { userId: A.id } })

describe("GET /scans/:id/report", () => {
  let id: string
  before(async () => void (id = await seedCompleted(A.id)))
  after(clearA)

  it("returns the grouped report", async () => {
    const { data } = await json(`/scans/${id}/report`)
    const r = data.report
    assert.equal(r.scan.score, 64)
    assert.equal(r.scan.grade, "D")
    assert.match(r.scan.verdict, /80 critical elements/)
    assert.deepEqual(r.rules.map((x: { id: string }) => x.id), ["image-alt", "color-contrast", "region"])
    const img = r.rules[0]
    assert.equal(img.totalNodes, 80)
    assert.equal(img.storedNodes, 3)
    assert.equal(img.criteria[0].name, "Non-text Content")
    assert.equal(img.principle, "perceivable")
    assert.equal(img.level, "A")
    assert.ok(img.audiences.includes("screen-reader"))
    assert.deepEqual(r.severity.map((s: { elements: number }) => s.elements), [80, 12, 4, 0])
    assert.deepEqual(r.counts, { issues: 3, review: 1, passed: 1 })
    assert.equal(r.review[0].nodes[0].message, "bg image")
    assert.deepEqual(r.screenshot, { width: 1280, height: 900 })
    assert.deepEqual(r.markers.map((m: { n: number; ruleId: string }) => [m.n, m.ruleId]), [[1, "image-alt"], [2, "image-alt"], [3, "color-contrast"], [4, "region"]])
    assert.ok(!JSON.stringify(r).includes(A.id), "no user id in the report")
  })

  it("still works for scans stored before per-rule summaries (derived, flagged approximate)", async () => {
    const legacy = await seedCompleted(A.id, { rules: null, reviewItems: [], passedRules: [] })
    const r = (await json(`/scans/${legacy}/report`)).data.report
    assert.equal(r.rules.length, 3)
    assert.ok(r.rules.every((x: { approximate: boolean }) => x.approximate))
    assert.deepEqual(r.counts, { issues: 3, review: 0, passed: 0 })
  })

  it("is only for finished scans and only for the owner", async () => {
    const queued = await prisma.scan.create({ data: { userId: A.id, url: "https://q.example", normalizedUrl: "https://q.example/" } })
    assert.equal((await call(`/scans/${queued.id}/report`, A.token)).status, 409)
    assert.equal((await call(`/scans/${id}/report`, B.token)).status, 404)
    assert.equal((await call(`/scans/${id}/report`)).status, 401)
  })
})

describe("GET /scans/:id/rules/:ruleId/nodes", () => {
  let id: string
  before(async () => void (id = await seedCompleted(A.id)))
  after(clearA)

  it("pages through a rule's elements in order, with positions", async () => {
    const p1 = (await json(`/scans/${id}/rules/image-alt/nodes?limit=2`)).data
    assert.deepEqual(p1.items.map((n: { occurrenceIndex: number }) => n.occurrenceIndex), [0, 1])
    assert.ok(p1.nextCursor)
    assert.deepEqual(p1.items[0].boundingBox, { x: 10, y: 0, width: 100, height: 50 })
    const p2 = (await json(`/scans/${id}/rules/image-alt/nodes?limit=2&cursor=${p1.nextCursor}`)).data
    assert.deepEqual(p2.items.map((n: { occurrenceIndex: number }) => n.occurrenceIndex), [2])
    assert.equal(p2.nextCursor, null)
    assert.equal(p2.items[0].boundingBox, null)
    assert.ok(p1.items[0].failureSummary.includes("alt attribute"))
  })

  it("returns an empty page for a rule that has no stored elements", async () => assert.deepEqual((await json(`/scans/${id}/rules/nope/nodes`)).data.items, []))
  it("is scoped to the owner and validates the rule id", async () => {
    assert.equal((await call(`/scans/${id}/rules/image-alt/nodes`, B.token)).status, 404)
    assert.equal((await call(`/scans/${id}/rules/${encodeURIComponent("a b;")}/nodes`, A.token)).status, 400)
  })
})

describe("GET /scans (history)", () => {
  const ids: Record<string, string> = {}
  before(async () => {
    const mk = (name: string, data: object) =>
      prisma.scan.create({ data: { userId: A.id, url: `https://${name}.example.com/`, normalizedUrl: `https://${name}.example.com/`, ...data } }).then((s) => (ids[name] = s.id))
    const t = (min: number) => new Date(Date.now() - min * 60_000)
    await mk("alpha", { status: "COMPLETED", score: 95, viewport: "DESKTOP", pageTitle: "Alpha Bakery", createdAt: t(50) })
    await mk("bravo", { status: "COMPLETED", score: 40, viewport: "MOBILE", pageTitle: "Bravo Hardware", createdAt: t(40) })
    await mk("charlie", { status: "COMPLETED", score: 72, viewport: "MOBILE", createdAt: t(30) })
    await mk("delta", { status: "FAILED", errorCode: "TIMEOUT", createdAt: t(20) })
    await mk("echo", { status: "CANCELLED", createdAt: t(10) })
    await mk("foxtrot", { status: "COMPLETED", score: 72, createdAt: t(5) })
  })
  after(clearA)
  const names = async (qs: string) => (await json(`/scans?${qs}`)).data.items.map((s: { normalizedUrl: string }) => new URL(s.normalizedUrl).hostname.split(".")[0])

  it("defaults to newest first", async () => assert.deepEqual(await names(""), ["foxtrot", "echo", "delta", "charlie", "bravo", "alpha"]))
  it("sorts oldest first", async () => assert.deepEqual((await names("order=asc")).slice(0, 2), ["alpha", "bravo"]))
  it("searches the URL and the page title, case-insensitively", async () => {
    assert.deepEqual(await names("q=BRAV"), ["bravo"])
    assert.deepEqual(await names("q=bakery"), ["alpha"])
    assert.deepEqual(await names("q=%25"), []) // a literal %, not a wildcard
  })
  it("filters by status and viewport", async () => {
    assert.deepEqual(await names("status=FAILED"), ["delta"])
    assert.deepEqual(await names("viewport=MOBILE"), ["charlie", "bravo"])
  })
  it("filters by score range (only scored scans)", async () => {
    assert.deepEqual(await names("minScore=70"), ["foxtrot", "charlie", "alpha"])
    assert.deepEqual(await names("minScore=40&maxScore=72"), ["foxtrot", "charlie", "bravo"])
    assert.equal((await call("/scans?minScore=80&maxScore=10", A.token)).status, 400)
  })
  it("sorts by score, leaving out scans that have none", async () => {
    assert.deepEqual(await names("sort=score&order=desc"), ["alpha", "foxtrot", "charlie", "bravo"]) // 72 tie → newest first
    assert.deepEqual(await names("sort=score&order=asc"), ["bravo", "foxtrot", "charlie", "alpha"])
  })
  it("treats empty filter fields as 'not set'", async () => assert.equal((await names("q=&status=&viewport=&minScore=&maxScore=&sort=&order=")).length, 6))
  it("paginates with a cursor, without gaps or repeats, for both sorts", async () => {
    for (const sort of ["date", "score"]) {
      const seen: string[] = []
      let cursor: string | null = null
      for (let guard = 0; guard < 10; guard++) {
        const page: { items: { id: string }[]; nextCursor: string | null } = (await json(`/scans?limit=2&sort=${sort}${cursor ? `&cursor=${cursor}` : ""}`)).data
        seen.push(...page.items.map((s) => s.id))
        if (!(cursor = page.nextCursor)) break
      }
      assert.equal(new Set(seen).size, seen.length, `${sort}: no repeats`)
      assert.equal(seen.length, sort === "date" ? 6 : 4, `${sort}: nothing missed`)
    }
  })
  it("never shows another user's scans", async () => assert.equal((await json("/scans", B.token)).data.items.length, 0))
})

describe("GET /scans/stats", () => {
  after(clearA)
  it("totals, average score and the most common issue", async () => {
    assert.deepEqual((await json("/scans/stats")).data, { totalScans: 0, completedScans: 0, averageScore: null, mostCommonIssue: null })
    await seedCompleted(A.id, { score: 60 })
    await seedCompleted(A.id, { score: 81 })
    await prisma.scan.create({ data: { userId: A.id, url: "https://f.example", normalizedUrl: "https://f.example/", status: "FAILED" } })
    const s = (await json("/scans/stats")).data
    assert.equal(s.totalScans, 3)
    assert.equal(s.completedScans, 2)
    assert.equal(s.averageScore, 71) // round(70.5)
    // every seeded scan has the same rules, so the tie is broken alphabetically
    assert.deepEqual(s.mostCommonIssue, { ruleId: "color-contrast", help: "color-contrast help", scans: 2 })
  })
})

describe("soft delete", () => {
  after(clearA)
  it("hides the scan everywhere but keeps the row", async () => {
    const id = await seedCompleted(A.id)
    assert.equal((await call(`/scans/${id}`, A.token, { method: "DELETE" })).status, 200)
    for (const path of [`/scans/${id}`, `/scans/${id}/report`, `/scans/${id}/screenshot`, `/scans/${id}/issues`, `/scans/${id}/rules/image-alt/nodes`]) assert.equal((await call(path, A.token)).status, 404, path)
    assert.equal((await post(`/scans/${id}/rescan`, A.token)).status, 404)
    assert.equal((await post(`/scans/${id}/cancel`, A.token)).status, 404)
    assert.equal((await call(`/scans/${id}`, A.token, { method: "DELETE" })).status, 404, "deleting twice")
    assert.ok(!(await json("/scans")).data.items.some((s: { id: string }) => s.id === id))
    assert.equal((await json("/scans/stats")).data.totalScans, 0)
    assert.ok((await prisma.scan.findUnique({ where: { id } }))?.deletedAt)
  })

  it("does NOT hand the hourly scan limit back", async () => {
    await clearA()
    const ids = await Promise.all(Array.from({ length: env.SCAN_RATE_LIMIT_PER_HOUR }, (_, i) => seedCompleted(A.id, { url: `https://h${i}.example`, normalizedUrl: `https://h${i}.example/` })))
    assert.equal((await post("/scans", A.token, { url: "https://one-too-many.example" })).status, 429)
    assert.equal((await call(`/scans/${ids[0]}`, A.token, { method: "DELETE" })).status, 200)
    const again = await post("/scans", A.token, { url: "https://one-too-many.example" })
    assert.equal(again.status, 429, "deleting must not reset the limit")
    assert.equal((await again.json()).error.code, "RATE_LIMITED")
  })

  it("refuses to delete a scan that is still running", async () => {
    await clearA()
    const running = await prisma.scan.create({ data: { userId: A.id, url: "https://r.example", normalizedUrl: "https://r.example/", status: "RUNNING" } })
    assert.equal((await call(`/scans/${running.id}`, A.token, { method: "DELETE" })).status, 409)
  })

  it("purges long-deleted rows and keeps recent ones", async () => {
    await clearA()
    const old = await seedCompleted(A.id, { deletedAt: new Date(Date.now() - 8 * 86_400_000) })
    const recent = await seedCompleted(A.id, { deletedAt: new Date(Date.now() - 86_400_000) })
    const live = await seedCompleted(A.id)
    const purged = await purgeDeletedScans(7)
    assert.ok(purged >= 1)
    assert.equal(await prisma.scan.findUnique({ where: { id: old } }), null)
    assert.equal(await prisma.issue.count({ where: { scanId: old } }), 0, "issues cascade with the purge")
    assert.ok(await prisma.scan.findUnique({ where: { id: recent } }))
    assert.ok(await prisma.scan.findUnique({ where: { id: live } }))
  })
})

describe("POST /scans/:id/rescan", () => {
  after(clearA)
  it("queues a new scan of the same URL and screen size", async () => {
    await clearA()
    const id = await seedCompleted(A.id, { viewport: "MOBILE" })
    const res = await post(`/scans/${id}/rescan`, A.token)
    assert.equal(res.status, 202)
    const { scan } = (await res.json()).data
    assert.notEqual(scan.id, id)
    assert.equal(scan.status, "QUEUED")
    assert.equal(scan.normalizedUrl, "https://shop.example.com/")
    assert.equal(scan.viewport, "MOBILE")
  })
  it("belongs to the owner only", async () => {
    const id = await seedCompleted(A.id)
    assert.equal((await post(`/scans/${id}/rescan`, B.token)).status, 404)
  })
  it("respects the active-scan limit and the hourly limit", async () => {
    await clearA()
    const id = await seedCompleted(A.id)
    for (let i = 0; i < env.SCAN_MAX_ACTIVE_PER_USER; i++) assert.equal((await post(`/scans/${id}/rescan`, A.token)).status, 202)
    const over = await post(`/scans/${id}/rescan`, A.token)
    assert.equal(over.status, 429)
    assert.equal((await over.json()).error.code, "TOO_MANY_ACTIVE")

    await clearA()
    const seed = await seedCompleted(A.id)
    await prisma.scan.createMany({ data: Array.from({ length: env.SCAN_RATE_LIMIT_PER_HOUR }, (_, i) => ({ userId: A.id, url: `https://z${i}.example`, normalizedUrl: `https://z${i}.example/`, status: "COMPLETED" as const })) })
    const limited = await post(`/scans/${seed}/rescan`, A.token)
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).error.code, "RATE_LIMITED")
  })
})
