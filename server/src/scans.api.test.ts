// API-level tests for /api/scans (needs the local Postgres; the worker is not started, so scans stay QUEUED).
import assert from "node:assert/strict"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./services/prisma.js"

const stamp = Date.now()
const emails = [`api-a-${stamp}@example.com`, `api-b-${stamp}@example.com`]
let server: Server
let base: string
let A: { token: string; id: string }
let B: { token: string; id: string }

const call = (path: string, token?: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: env.CLIENT_URL[0]!, ...(token && { Authorization: `Bearer ${token}` }) } })
const post = (path: string, token: string | undefined, body: unknown) => call(path, token, { method: "POST", body: JSON.stringify(body) })

async function signUp(email: string) {
  const res = await post("/auth/register", undefined, { name: "Api Test", email, password: "Sup3rSecret99" })
  const { data } = await res.json()
  return { token: data.accessToken as string, id: data.user.id as string }
}

before(async () => {
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  ;[A, B] = await Promise.all(emails.map(signUp)) as [typeof A, typeof B]
})
after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.$disconnect()
  server.close()
})

describe("POST /scans", () => {
  it("requires authentication", async () => {
    assert.equal((await post("/scans", undefined, { url: "https://example.com" })).status, 401)
    assert.equal((await call("/scans")).status, 401)
  })

  it("rejects internal and malformed targets immediately with friendly codes", async () => {
    const cases: Array<[string, string]> = [
      ["http://localhost", "BLOCKED_HOST"], ["http://127.0.0.1:8080/admin", "BLOCKED_HOST"], ["http://169.254.169.254/latest/meta-data/", "BLOCKED_HOST"],
      ["http://[::1]/", "BLOCKED_HOST"], ["http://2130706433/", "BLOCKED_HOST"], ["https://example.com:8443", "BLOCKED_HOST"], ["http://intranet/", "BLOCKED_HOST"],
      ["file:///etc/passwd", "INVALID_URL"], ["javascript:alert(1)", "INVALID_URL"], ["ftp://example.com", "INVALID_URL"], ["https://user:pw@example.com", "INVALID_URL"],
    ]
    for (const [url, code] of cases) {
      const res = await post("/scans", A.token, { url })
      const body = await res.json()
      assert.equal(res.status, 400, url)
      assert.equal(body.error.code, code, url)
      assert.ok(!/stack|at\s.+\(/i.test(JSON.stringify(body)), "no stack traces")
    }
    assert.equal(await prisma.scan.count({ where: { userId: A.id } }), 0, "nothing was queued")
  })

  it("queues a valid scan (bare domain gets https) and returns 202 immediately", async () => {
    const res = await post("/scans", A.token, { url: "example.com", viewport: "MOBILE" })
    assert.equal(res.status, 202)
    const { data } = await res.json()
    assert.equal(data.scan.status, "QUEUED")
    assert.equal(data.scan.normalizedUrl, "https://example.com/")
    assert.equal(data.scan.viewport, "MOBILE")
    assert.ok(!("userId" in data.scan) && !("heartbeatAt" in data.scan))
    await prisma.scan.deleteMany({ where: { userId: A.id } })
  })

  it("enforces the per-user active limit", async () => {
    for (let i = 0; i < env.SCAN_MAX_ACTIVE_PER_USER; i++) assert.equal((await post("/scans", A.token, { url: `https://example.com/${i}` })).status, 202)
    const over = await post("/scans", A.token, { url: "https://example.com/over" })
    assert.equal(over.status, 429)
    assert.equal((await over.json()).error.code, "TOO_MANY_ACTIVE")
    await prisma.scan.deleteMany({ where: { userId: A.id } })
  })

  it("enforces the hourly rate limit", async () => {
    await prisma.scan.createMany({ data: Array.from({ length: env.SCAN_RATE_LIMIT_PER_HOUR }, (_, i) => ({ userId: A.id, url: `https://e.com/${i}`, normalizedUrl: `https://e.com/${i}`, status: "COMPLETED" as const })) })
    const res = await post("/scans", A.token, { url: "https://example.com" })
    assert.equal(res.status, 429)
    assert.equal((await res.json()).error.code, "RATE_LIMITED")
    await prisma.scan.deleteMany({ where: { userId: A.id } })
  })
})

describe("reading, cancelling and deleting", () => {
  let scanId: string
  before(async () => {
    scanId = (await prisma.scan.create({ data: { userId: A.id, url: "https://example.com", normalizedUrl: "https://example.com/", status: "COMPLETED", score: 80, criticalCount: 1 } })).id
    await prisma.issue.createMany({
      data: [
        { impact: "MINOR", ruleId: "z-minor" }, { impact: "CRITICAL", ruleId: "b-crit" }, { impact: "CRITICAL", ruleId: "a-crit" }, { impact: "SERIOUS", ruleId: "s-1" }, { impact: "SERIOUS", ruleId: "s-2" },
      ].map((i, n) => ({ ...i, impact: i.impact as "MINOR", scanId, wcagTags: ["wcag2a"], wcagCriteria: ["1.1.1"], help: "h", description: "d", helpUrl: "https://x", selector: "img", html: "<img>", failureSummary: "f", occurrenceIndex: n })),
    })
  })

  it("only the owner can see a scan; others get 404", async () => {
    assert.equal((await call(`/scans/${scanId}`, A.token)).status, 200)
    for (const path of [`/scans/${scanId}`, `/scans/${scanId}/issues`, `/scans/${scanId}/screenshot`]) assert.equal((await call(path, B.token)).status, 404, path)
    assert.equal((await post(`/scans/${scanId}/cancel`, B.token, {})).status, 404)
    assert.equal((await call(`/scans/${scanId}`, B.token, { method: "DELETE" })).status, 404)
    assert.equal((await call(`/scans`, B.token).then((r) => r.json())).data.items.length, 0)
  })

  it("lists scans with cursor pagination and status filter", async () => {
    await prisma.scan.createMany({ data: [1, 2].map((i) => ({ userId: A.id, url: `https://e.com/${i}`, normalizedUrl: `https://e.com/${i}`, status: "FAILED" as const, errorCode: "TIMEOUT" })) })
    const page1 = (await call("/scans?limit=2", A.token).then((r) => r.json())).data
    assert.equal(page1.items.length, 2)
    assert.ok(page1.nextCursor)
    const page2 = (await call(`/scans?limit=2&cursor=${page1.nextCursor}`, A.token).then((r) => r.json())).data
    assert.equal(page2.items.length, 1)
    assert.equal(page2.nextCursor, null)
    const failed = (await call("/scans?status=FAILED", A.token).then((r) => r.json())).data.items
    assert.equal(failed.length, 2)
    assert.equal((await call("/scans?status=BOGUS", A.token)).status, 400)
  })

  it("lists issues critical-first, paginated, filterable by impact", async () => {
    const all = (await call(`/scans/${scanId}/issues`, A.token).then((r) => r.json())).data.items
    assert.deepEqual(all.map((i: { ruleId: string }) => i.ruleId), ["a-crit", "b-crit", "s-1", "s-2", "z-minor"])
    assert.ok(!("scanId" in all[0]))
    const p1 = (await call(`/scans/${scanId}/issues?limit=2`, A.token).then((r) => r.json())).data
    assert.equal(p1.items.length, 2)
    const p2 = (await call(`/scans/${scanId}/issues?limit=2&cursor=${p1.nextCursor}`, A.token).then((r) => r.json())).data
    assert.deepEqual(p2.items.map((i: { ruleId: string }) => i.ruleId), ["s-1", "s-2"])
    const crit = (await call(`/scans/${scanId}/issues?impact=CRITICAL`, A.token).then((r) => r.json())).data.items
    assert.equal(crit.length, 2)
  })

  it("serves the screenshot as an image with the right headers", async () => {
    assert.equal((await call(`/scans/${scanId}/screenshot`, A.token)).status, 404) // none stored yet
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3])
    await prisma.scanScreenshot.create({ data: { scanId, data: bytes, mime: "image/jpeg", width: 1280, height: 10, bytes: bytes.length } })
    const res = await call(`/scans/${scanId}/screenshot`, A.token)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get("content-type"), "image/jpeg")
    assert.equal(res.headers.get("x-content-type-options"), "nosniff")
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes)
    assert.equal((await call(`/scans/${scanId}`, A.token).then((r) => r.json())).data.scan.hasScreenshot, true)
  })

  it("rejects malformed ids", async () => assert.equal((await call("/scans/not-a-uuid", A.token)).status, 400))

  it("cancel: QUEUED → CANCELLED, repeat → 409; delete refuses active scans but removes finished ones", async () => {
    await prisma.scan.deleteMany({ where: { userId: A.id, status: { not: "COMPLETED" } } })
    const queued = (await post("/scans", A.token, { url: "https://example.com/c" }).then((r) => r.json())).data.scan.id
    assert.equal((await call(`/scans/${queued}`, A.token, { method: "DELETE" })).status, 409)
    const cancelled = await post(`/scans/${queued}/cancel`, A.token, {})
    assert.equal(cancelled.status, 200)
    assert.equal((await cancelled.json()).data.scan.status, "CANCELLED")
    assert.equal((await post(`/scans/${queued}/cancel`, A.token, {})).status, 409)
    assert.equal((await call(`/scans/${queued}`, A.token, { method: "DELETE" })).status, 200)
    assert.equal((await call(`/scans/${queued}`, A.token)).status, 404)
    assert.equal((await call(`/scans/${scanId}`, A.token, { method: "DELETE" })).status, 200)
    assert.equal(await prisma.issue.count({ where: { scanId } }), 0, "issues cascade")
  })
})
