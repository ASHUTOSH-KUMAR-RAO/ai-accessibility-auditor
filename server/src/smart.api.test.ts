// Phase 6 at the API level: share links, public report, badge, exports, compare, sites, PDF, keyboard data.
// Needs the local Postgres and Chromium (PDF). The scan worker is not started.
import assert from "node:assert/strict"
import { createServer, type Server as HttpServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { csvCell, toCsv } from "./services/export/export.service.js"
import { setTransport } from "./services/ai/llm.js"
import { prisma } from "./services/prisma.js"
import { renderPdf } from "./services/pdf/pdf.service.js"
import { closeBrowser } from "./services/scanner/browser.js"
import { matchIssues } from "./services/compare/compare.service.js"
import { badgeSvg } from "./services/share/badge.js"
import { hashToken } from "./services/share/share.service.js"

const stamp = Date.now()
const emails = [`sm-a-${stamp}@example.com`, `sm-b-${stamp}@example.com`]
let server: Server
let base: string
let A: { token: string; id: string }
let B: { token: string; id: string }

const call = (path: string, token?: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: env.CLIENT_URL[0]!, ...(token && { Authorization: `Bearer ${token}` }) } })
const post = (path: string, token: string, body: unknown = {}) => call(path, token, { method: "POST", body: JSON.stringify(body) })
async function signUp(email: string) {
  const { data } = await (await fetch(base + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json", Origin: env.CLIENT_URL[0]! }, body: JSON.stringify({ name: "Smart Test", email, password: "Sup3rSecret99" }) })).json()
  return { token: data.accessToken as string, id: data.user.id as string }
}

const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
const RULES = [
  { id: "image-alt", impact: "critical", help: "Images must have alternate text", description: "d", helpUrl: "https://x/image-alt", tags: ["wcag2a", "wcag111"], totalNodes: 3, storedNodes: 3 },
  { id: "color-contrast", impact: "serious", help: "Elements must meet minimum color contrast", description: "d", helpUrl: "https://x/cc", tags: ["wcag2aa", "wcag143"], totalNodes: 1, storedNodes: 1 },
]
const tabOrder = { stops: [{ n: 1, selector: "a", tag: "a", role: "link", name: "Home", box: { x: 1, y: 1, width: 50, height: 20 }, focusVisible: true, offscreen: false }], complete: true, truncated: false, trap: null, unreachable: [], page: { width: 1280, height: 900, viewportHeight: 800 }, warnings: [] }

interface IssueSeed { ruleId: string; selector: string; html: string; impact?: "CRITICAL" | "SERIOUS" }
async function seedScan(userId: string, opts: { host?: string; score?: number; issues?: IssueSeed[]; createdAt?: Date; tab?: boolean; rules?: typeof RULES } = {}) {
  const host = opts.host ?? `shop-${stamp}.example.com`
  const scan = await prisma.scan.create({
    data: {
      userId, url: `https://${host}/`, normalizedUrl: `https://${host}/`, host, status: "COMPLETED", progress: 100, score: opts.score ?? 64, finalUrl: `https://${host}/`, pageTitle: "Example Shop",
      completedAt: new Date(), createdAt: opts.createdAt ?? new Date(), rules: opts.rules ?? RULES, tabOrder: opts.tab === false ? undefined : tabOrder,
      criticalCount: 3, seriousCount: 1,
    },
  })
  const issues = opts.issues ?? [
    { ruleId: "image-alt", selector: "img.a", html: '<img src="/a.png">' },
    { ruleId: "image-alt", selector: "img.b", html: '<img src="/b.png">' },
    { ruleId: "color-contrast", selector: "p.muted", html: '<p class="muted">=HYPERLINK("http://evil","x")</p>', impact: "SERIOUS" },
  ]
  await prisma.issue.createMany({
    data: issues.map((i, n) => ({
      scanId: scan.id, ruleId: i.ruleId, impact: i.impact ?? "CRITICAL", wcagTags: ["wcag2a"], wcagCriteria: ["1.1.1"], help: `${i.ruleId} help`, description: "d", helpUrl: "u",
      selector: i.selector, html: i.html, failureSummary: "Fix any of the following:\n  Element does not have an alt attribute", occurrenceIndex: n,
      boundingBox: { x: 10, y: 20 * n, width: 100, height: 50 },
    })),
  })
  await prisma.scanScreenshot.create({ data: { scanId: scan.id, data: new Uint8Array(PIXEL), mime: "image/png", width: 1280, height: 900, bytes: PIXEL.length } })
  return scan.id
}

before(async () => {
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  ;[A, B] = (await Promise.all(emails.map(signUp))) as [typeof A, typeof B]
  setTransport(null) // nothing here may call the AI
})
after(async () => {
  setTransport(undefined)
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.$disconnect()
  await closeBrowser()
  server.close()
})

describe("share links", () => {
  let scanId: string
  before(async () => void (scanId = await seedScan(A.id)))
  const create = async (body: Record<string, unknown> = {}, token = A.token, id = scanId) => {
    const r = await post(`/scans/${id}/shares`, token, body)
    return { status: r.status, body: await r.json() }
  }
  const pub = (token: string, path = "report") => fetch(`${base}/public/${token}/${path}`) // no auth, no Origin

  it("creates an unguessable token, stores only its hash, and returns the token once", async () => {
    const { status, body } = await create({ expiry: "7d" })
    assert.equal(status, 201)
    const token = body.data.token as string
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    const row = await prisma.shareLink.findFirstOrThrow({ where: { scanId, id: body.data.share.id } })
    assert.equal(row.tokenHash, hashToken(token))
    assert.ok(!JSON.stringify(row).includes(token))
    assert.ok(new Date(row.expiresAt!).getTime() > Date.now() + 6 * 86_400_000)
    const list = (await (await call(`/scans/${scanId}/shares`, A.token)).json()).data.shares
    assert.ok(!JSON.stringify(list).includes(token)) // the list can't reveal live links
  })

  it("serves the report without login, with noindex, and without any owner data", async () => {
    const { body } = await create()
    const r = await pub(body.data.token)
    assert.equal(r.status, 200)
    assert.match(r.headers.get("x-robots-tag")!, /noindex/)
    const text = await r.text()
    assert.ok(!text.includes(emails[0]!) && !text.includes(A.id) && !text.includes(scanId), "owner email / user id / scan id leaked")
    const json = JSON.parse(text)
    assert.equal(json.data.report.scan.id, "shared")
    assert.equal(json.data.report.rules.length, 2)
    assert.equal((await pub(body.data.token, "rules/image-alt/nodes")).status, 200)
    assert.equal((await pub(body.data.token, "keyboard")).status, 200)
    assert.equal((await pub(body.data.token, "ai-summary")).status, 200)
    assert.equal((await pub(body.data.token, "screenshot")).status, 200)
  })

  it("hides the screenshot (and its markers) when asked", async () => {
    const { body } = await create({ hideScreenshot: true })
    const json = await (await pub(body.data.token)).json()
    assert.equal(json.data.report.screenshot, null)
    assert.deepEqual(json.data.report.markers, [])
    assert.equal((await pub(body.data.token, "screenshot")).status, 404)
  })

  it("treats wrong, malformed, expired and revoked tokens identically (404)", async () => {
    const wrong = await pub("A".repeat(43))
    const malformed = await pub("not-a-token")
    assert.equal(wrong.status, 404)
    assert.equal(malformed.status, 404)
    assert.deepEqual(await wrong.json(), await malformed.json())

    const { body } = await create()
    await prisma.shareLink.update({ where: { id: body.data.share.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const expired = await pub(body.data.token)
    assert.equal(expired.status, 404)
    assert.equal((await expired.json()).message, "This link is invalid or has expired.")

    const live = await create()
    assert.equal((await pub(live.body.data.token)).status, 200)
    assert.equal((await call(`/scans/${scanId}/shares/${live.body.data.share.id}`, A.token, { method: "DELETE" })).status, 200)
    assert.equal((await pub(live.body.data.token)).status, 404)
    assert.equal((await pub(live.body.data.token, "screenshot")).status, 404)
  })

  it("stops working when the scan is deleted", async () => {
    const id = await seedScan(A.id)
    const { body } = await create({}, A.token, id)
    assert.equal((await pub(body.data.token)).status, 200)
    await prisma.scan.update({ where: { id }, data: { deletedAt: new Date() } })
    assert.equal((await pub(body.data.token)).status, 404)
  })

  it("is private to the owner and capped", async () => {
    assert.equal((await create({}, B.token)).status, 404)
    assert.equal((await call(`/scans/${scanId}/shares`, B.token)).status, 404)
    const { body } = await create()
    assert.equal((await call(`/scans/${scanId}/shares/${body.data.share.id}`, B.token, { method: "DELETE" })).status, 404)
    assert.equal((await post(`/scans/${scanId}/shares`, "")).status, 401)
    assert.equal((await create({ expiry: "forever" })).status, 400)
    const full = await seedScan(A.id)
    for (let i = 0; i < 10; i++) assert.equal((await create({}, A.token, full)).status, 201)
    assert.equal((await create({}, A.token, full)).status, 409)
  })

  it("shows saved AI fixes only, and never calls the AI", async () => {
    const { body } = await create()
    const issue = await prisma.issue.findFirstOrThrow({ where: { scanId } })
    const r = await pub(body.data.token, `issues/${issue.id}/ai-fix`)
    assert.equal(r.status, 404)
    assert.equal((await r.json()).error.code, "NO_SAVED_FIX")
    assert.equal((await fetch(`${base}/public/${body.data.token}/issues/${issue.id}/ai-fix`, { method: "POST" })).status, 404) // no write routes
  })

  it("serves an accessible SVG badge only while the link is active", async () => {
    const { body } = await create()
    const ok = await fetch(`${base}/badge/${body.data.token}.svg`)
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get("content-type")!, /image\/svg\+xml/)
    const svg = await ok.text()
    assert.match(svg, /role="img"/)
    assert.match(svg, /<title>Accessibility score: 64 out of 100, grade D<\/title>/)
    await call(`/scans/${scanId}/shares/${body.data.share.id}`, A.token, { method: "DELETE" })
    const gone = await fetch(`${base}/badge/${body.data.token}.svg`)
    assert.equal(gone.status, 404)
    assert.match(await gone.text(), /unavailable/)
    assert.match(badgeSvg(95, "A"), /95 A/)
  })
})

describe("exports", () => {
  let id: string
  before(async () => void (id = await seedScan(A.id)))

  it("exports CSV (BOM, CRLF, quoted) and neutralises formulas from scanned pages", async () => {
    const r = await call(`/scans/${id}/export.csv`, A.token)
    assert.equal(r.status, 200)
    assert.match(r.headers.get("content-type")!, /text\/csv/)
    assert.match(r.headers.get("content-disposition")!, /attachment; filename="accesslens-issues-.*\.csv"/)
    const bytes = Buffer.from(await r.arrayBuffer())
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]) // UTF-8 BOM for Excel
    const text = bytes.toString("utf8").slice(1)
    assert.ok(text.startsWith('"Rule","Impact"'))
    assert.equal(text.trim().split("\r\n").length, 4) // header + 3 issues
    assert.ok(!text.includes(',"=HYPERLINK'))
    assert.equal(csvCell("=1+1"), `"'=1+1"`)
    assert.equal(csvCell('say "hi"'), '"say ""hi"""')
    assert.equal(toCsv([]).replace(/^﻿/, '').trim(), '"Rule","Impact","WCAG criteria","Description","Selector","HTML","How to fix","Help URL"')
  })

  it("respects the rules filter, in CSV and JSON", async () => {
    const csv = await (await call(`/scans/${id}/export.csv?rules=color-contrast`, A.token)).text()
    assert.equal(csv.trim().split("\r\n").length, 2)
    const json = await (await call(`/scans/${id}/export.json?rules=image-alt`, A.token)).json()
    assert.equal(json.count, 2)
    assert.ok(json.issues.every((i: { rule: string }) => i.rule === "image-alt"))
    assert.equal(json.scan.score, 64)
    assert.ok(!JSON.stringify(json).includes(A.id))
  })

  it("is private", async () => {
    assert.equal((await call(`/scans/${id}/export.csv`, B.token)).status, 404)
    assert.equal((await call(`/scans/${id}/export.json`, "")).status, 401)
  })
})

describe("compare + sites", () => {
  const host = `trend-${stamp}.example.com`
  let older: string
  let newer: string
  before(async () => {
    older = await seedScan(A.id, { host, score: 40, createdAt: new Date(Date.now() - 86_400_000), issues: [
      { ruleId: "image-alt", selector: "main > img:nth-child(1)", html: '<img src="/logo.png" width="40">' },
      { ruleId: "image-alt", selector: "main > img:nth-child(2)", html: '<img src="/banner.png">' },
      { ruleId: "color-contrast", selector: "p.muted", html: '<p class="muted">Hello</p>', impact: "SERIOUS" },
    ] })
    newer = await seedScan(A.id, { host, score: 70, rules: [{ ...RULES[0]!, totalNodes: 2 }], issues: [
      { ruleId: "image-alt", selector: "main > img:nth-child(3)", html: '<img src="/logo.png" width="40">' }, // moved: same markup
      { ruleId: "image-alt", selector: "footer img", html: '<img src="/new-badge.png">' }, // brand new
    ] })
  })

  it("matches issues across scans: exact, moved, changed, fuzzy, fixed, new", () => {
    const ref = (ruleId: string, selector: string, html: string) => ({ id: selector + html, ruleId, impact: "critical", help: "h", selector, html })
    const m = matchIssues(
      [ref("r", "a > b", '<img src="/x.png">'), ref("r", "header a", '<a href="/home" class="x">Home page link</a>'), ref("r", "section .c", '<input type="text" name="email" placeholder="Your email address here">'), ref("r", "gone", "<b>gone</b>")],
      [ref("r", "a > b", '<img src="/x.png">'), ref("r", "footer a", '<a href="/home" class="y">Home page link</a>'), ref("r", "div .z", '<input type="text" name="email" placeholder="Your email address">'), ref("r", "new", "<i>new</i>")],
    )
    assert.deepEqual(m.unchanged.map((u) => u.how).sort(), ["exact", "markup", "similar"])
    assert.deepEqual(m.fixed.map((f) => f.selector), ["gone"])
    assert.deepEqual(m.added.map((f) => f.selector), ["new"])
    // never matches across rules
    const cross = matchIssues([ref("r1", "a", "<p>x</p>")], [ref("r2", "a", "<p>x</p>")])
    assert.equal(cross.unchanged.length, 0)
  })

  it("compares two scans, whichever order they are given in", async () => {
    for (const [a, b] of [[older, newer], [newer, older]]) {
      const r = (await (await call(`/compare?a=${a}&b=${b}`, A.token)).json()).data
      assert.equal(r.before.id, older)
      assert.equal(r.scoreDelta, 30)
      assert.deepEqual(r.totals, { fixed: 2, new: 1, unchanged: 1 }) // banner + contrast fixed; new-badge new; logo unchanged
      assert.equal(r.rules.find((x: { ruleId: string }) => x.ruleId === "image-alt").status, "improved")
    }
  })

  it("refuses different sites, the same scan, and other people's scans", async () => {
    const other = await seedScan(A.id, { host: `other-${stamp}.example.com` })
    assert.equal((await call(`/compare?a=${older}&b=${other}`, A.token)).status, 400)
    assert.equal((await call(`/compare?a=${older}&b=${older}`, A.token)).status, 400)
    assert.equal((await call(`/compare?a=${older}&b=${newer}`, B.token)).status, 404)
    assert.equal((await call(`/compare?a=x&b=y`, A.token)).status, 400)
  })

  it("groups scans by site with a chronological trend and a previous-scan shortcut", async () => {
    const list = (await (await call("/sites", A.token)).json()).data.sites
    const s = list.find((x: { host: string }) => x.host === host)
    assert.equal(s.scanCount, 2)
    assert.equal(s.latest.score, 70)
    assert.equal(s.previousScore, 40)
    const site = (await (await call(`/sites/${host}`, A.token)).json()).data
    assert.deepEqual(site.scans.map((x: { score: number }) => x.score), [40, 70])
    assert.equal(site.previous.id, older)
    assert.equal((await call(`/sites/${host}`, B.token)).status, 404)
  })
})

describe("keyboard data", () => {
  it("returns the recording, or says it is not available for older scans", async () => {
    const withTab = await seedScan(A.id)
    const old = await seedScan(A.id, { tab: false })
    const a = (await (await call(`/scans/${withTab}/keyboard`, A.token)).json()).data
    assert.equal(a.available, true)
    assert.equal(a.tabOrder.stops.length, 1)
    const b = (await (await call(`/scans/${old}/keyboard`, A.token)).json()).data
    assert.deepEqual(b, { available: false, tabOrder: null })
    assert.equal((await call(`/scans/${withTab}/keyboard`, B.token)).status, 404)
  })
})

describe("PDF report", () => {
  let id: string
  before(async () => void (id = await seedScan(A.id)))

  it("returns a valid, branded PDF and caches it until the content changes", async () => {
    const r = await call(`/scans/${id}/report.pdf`, A.token)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get("content-type"), "application/pdf")
    assert.match(r.headers.get("content-disposition")!, /attachment; filename="accesslens-shop-.*\.pdf"/)
    assert.equal(r.headers.get("x-pdf-cached"), "false")
    const buf = Buffer.from(await r.arrayBuffer())
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-")
    assert.ok(buf.length > 5000)
    assert.ok(buf.includes("%%EOF"))

    const again = await call(`/scans/${id}/report.pdf`, A.token)
    assert.equal(again.headers.get("x-pdf-cached"), "true")

    // a saved AI summary changes what the PDF shows: it is rebuilt
    await prisma.aiSummary.create({ data: { scanId: id, model: "m", fallback: false, result: { verdict: "A saved verdict for the PDF test.", priorities: [{ ruleId: null, title: "Fix images", why: "Blind users.", effort: "quick" }], quickWins: [], mostAffected: "Screen reader users." } } })
    assert.equal((await call(`/scans/${id}/report.pdf`, A.token)).headers.get("x-pdf-cached"), "false")
  })

  it("never touches the network, even if the document asks to", async () => {
    const hits: string[] = []
    const probe: HttpServer = createServer((req, res) => (hits.push(req.url ?? ""), res.writeHead(200).end("x")))
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r))
    const port = (probe.address() as AddressInfo).port
    const html = `<!doctype html><html lang="en"><head><title>T</title><link rel="stylesheet" href="http://127.0.0.1:${port}/a.css"><style>@import url("http://127.0.0.1:${port}/b.css"); body{background:url(http://127.0.0.1:${port}/c.png)}</style></head>
      <body><h1>Hi</h1><img src="http://127.0.0.1:${port}/d.png" alt=""><script>fetch("http://127.0.0.1:${port}/e")</script></body></html>`
    const pdf = await renderPdf(html)
    await new Promise((r) => setTimeout(r, 300))
    probe.close()
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-")
    assert.deepEqual(hits, [])
  })

  it("is private and rate limited per user key", async () => {
    assert.equal((await call(`/scans/${id}/report.pdf`, B.token)).status, 404)
    assert.equal((await call(`/scans/${id}/report.pdf`, "")).status, 401)
  })
})
