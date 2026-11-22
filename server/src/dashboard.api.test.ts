// Dashboard aggregates and the demo seed's safety switch.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./services/prisma.js"

const stamp = Date.now()
const emails = [`dash-a-${stamp}@example.com`, `dash-b-${stamp}@example.com`]
let server: Server
let base: string
let A: { token: string; id: string }
let B: { token: string; id: string }

const call = (path: string, token: string) => fetch(base + path, { headers: { Origin: env.CLIENT_URL[0]!, Authorization: `Bearer ${token}` } })
async function signUp(email: string) {
  const { data } = await (await fetch(base + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json", Origin: env.CLIENT_URL[0]! }, body: JSON.stringify({ name: "Dash Test", email, password: "Sup3rSecret99" }) })).json()
  return { token: data.accessToken as string, id: data.user.id as string }
}
const DAY = 86_400_000
async function scan(userId: string, host: string, score: number, daysAgo: number, extra: Record<string, unknown> = {}) {
  return prisma.scan.create({ data: { userId, url: `https://${host}/`, normalizedUrl: `https://${host}/`, host, status: "COMPLETED", score, createdAt: new Date(Date.now() - daysAgo * DAY), ...extra } })
}
const issue = (scanId: string, ruleId: string, impact: "CRITICAL" | "SERIOUS", help: string) => ({ scanId, ruleId, impact, wcagTags: [], wcagCriteria: [], help, description: "d", helpUrl: "u", selector: "x", html: "<x>", failureSummary: "f", occurrenceIndex: 0 })

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

describe("GET /dashboard", () => {
  it("is empty for a new user", async () => {
    const d = (await (await call("/dashboard", B.token)).json()).data
    assert.deepEqual(d.totals, { scans: 0, completed: 0, averageScore: null, sites: 0, aiFixesVerified: 0 })
    assert.deepEqual(d.sites, [])
    assert.deepEqual(d.topIssues, [])
  })

  it("aggregates totals, per-site trends and the most common issues, ignoring deleted and unfinished scans", async () => {
    const s1 = await scan(A.id, "one.example.com", 40, 30)
    const s2 = await scan(A.id, "one.example.com", 55, 20)
    const s3 = await scan(A.id, "one.example.com", 70, 10)
    const t1 = await scan(A.id, "two.example.com", 90, 5)
    await scan(A.id, "gone.example.com", 5, 4, { deletedAt: new Date() })
    await scan(A.id, "queued.example.com", 0, 1, { status: "QUEUED", score: null })
    await prisma.issue.createMany({ data: [
      issue(s1.id, "image-alt", "CRITICAL", "Images must have alternate text"), issue(s2.id, "image-alt", "CRITICAL", "Images must have alternate text"), issue(s3.id, "image-alt", "CRITICAL", "Images must have alternate text"),
      issue(s3.id, "color-contrast", "SERIOUS", "Contrast"), issue(t1.id, "color-contrast", "SERIOUS", "Contrast"),
    ] })
    await prisma.aiUsage.createMany({ data: [{ userId: A.id, verification: "VERIFIED" }, { userId: A.id, verification: "VERIFIED" }, { userId: A.id, verification: "NOT_VERIFIED" }, { userId: A.id }] })

    const d = (await (await call("/dashboard", A.token)).json()).data
    assert.deepEqual(d.totals, { scans: 5 + 0 + 0 + 0 + 0 + 0 - 1 + 1, completed: 4, averageScore: Math.round((40 + 55 + 70 + 90) / 4), sites: 2, aiFixesVerified: 2 })
    const one = d.sites.find((s: { host: string }) => s.host === "one.example.com")
    assert.deepEqual(one.trend, [40, 55, 70]) // oldest → newest: ready for a sparkline
    assert.equal(one.latest.score, 70)
    assert.equal(one.previousScore, 55)
    assert.equal(one.scanCount, 3)
    assert.ok(!d.sites.some((s: { host: string }) => s.host === "gone.example.com"))
    assert.deepEqual(d.topIssues.map((t: { ruleId: string; scans: number }) => [t.ruleId, t.scans]), [["image-alt", 3], ["color-contrast", 2]])
    assert.equal(d.topIssues[0].impact, "critical")
  })

  it("never mixes users and requires sign-in", async () => {
    const d = (await (await call("/dashboard", B.token)).json()).data
    assert.equal(d.totals.scans, 0)
    assert.equal((await fetch(base + "/dashboard", { headers: { Origin: env.CLIENT_URL[0]! } })).status, 401)
  })
})

describe("npm run seed:demo", () => {
  it("refuses to run in production without --force", () => {
    const r = spawnSync("npx", ["tsx", "scripts/seed-demo.ts"], { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8", shell: true, cwd: process.cwd() })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /Refusing to seed demo data in production/)
  })
})
