// End to end: a signed-out visitor types a URL on the landing page, signs up, and the scan starts by itself.
// Real Chromium + the built client (client/dist) + the real API, wired together in this file (no dev servers needed).
// Run `npm run build` in client/ first; the test is skipped when there is no build.
import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { createServer, request, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { extname, join, normalize, resolve } from "node:path"
import { after, before, describe, it } from "node:test"
import { chromium, type Browser } from "playwright"

const DIST = resolve(import.meta.dirname, "../../../client/dist")
const PORT = 5198 // the origin the API's CORS / CSRF check must accept
process.env.CLIENT_URL = `http://localhost:${PORT}`
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" }

const built = existsSync(join(DIST, "index.html"))
let api: Server
let web: Server
let browser: Browser
const stamp = Date.now()
const email = `e2e-${stamp}@example.com`

before(async () => {
  if (!built) return
  const { app } = await import("../app.js") // after CLIENT_URL is set
  api = app.listen(0)
  const apiPort = (api.address() as AddressInfo).port
  web = createServer((req, res) => {
    if (req.url?.startsWith("/api")) {
      const p = request({ host: "127.0.0.1", port: apiPort, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res) })
      return void req.pipe(p)
    }
    let file = normalize(join(DIST, decodeURIComponent((req.url ?? "/").split("?")[0]!)))
    if (!file.startsWith(DIST)) return void res.writeHead(403).end()
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(join(file, "index.html")) ? join(file, "index.html") : join(DIST, "index.html")
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file))
  }).listen(PORT)
  browser = await chromium.launch()
})
after(async () => {
  if (!built) return
  const { prisma } = await import("../services/prisma.js")
  await prisma.user.deleteMany({ where: { email } })
  await prisma.$disconnect()
  await browser?.close()
  api?.close()
  web?.close()
})

describe("signed-out URL → sign-up → automatic scan", { skip: built ? false : "client/dist is missing: run `npm run build` in client/" }, () => {
  it("remembers the address, creates the account and starts the scan", async () => {
    const { prisma } = await import("../services/prisma.js")
    const typed = `scan-me-${stamp}.example.com/some/page`
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(() => localStorage.setItem("accesslens:cookie-notice", "1"))
    const page = await ctx.newPage()

    await page.goto(`http://localhost:${PORT}/`)
    await page.getByLabel("Website to audit").fill(typed)
    await page.getByRole("button", { name: /Scan website/ }).click()
    await page.waitForURL("**/signup")
    // the address is remembered while the visitor fills in the form
    assert.match(await page.evaluate(() => localStorage.getItem("accesslens:pending-url") ?? ""), new RegExp(`scan-me-${stamp}\\.example\\.com`))

    await page.getByLabel("Name", { exact: true }).fill("E2E Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill("Sup3rSecret99")
    await page.getByLabel("Confirm password").fill("Sup3rSecret99")
    await page.getByRole("button", { name: "Create account" }).click()

    // signed in → dashboard → the remembered address is scanned without typing it again
    await page.waitForURL(/\/scans\/[0-9a-f-]{36}/, { timeout: 20_000 })
    const scanId = /\/scans\/([0-9a-f-]{36})/.exec(page.url())![1]!
    const scan = await prisma.scan.findUnique({ where: { id: scanId }, include: { user: { select: { email: true } } } })
    assert.equal(scan?.user.email, email)
    assert.equal(scan?.host, `scan-me-${stamp}.example.com`)
    assert.match(scan!.normalizedUrl, /\/some\/page/)
    // used once: reloading the dashboard does not start a second scan
    assert.equal(await page.evaluate(() => localStorage.getItem("accesslens:pending-url")), null)
    await page.goto(`http://localhost:${PORT}/dashboard`)
    await page.waitForTimeout(2000)
    assert.equal(await prisma.scan.count({ where: { userId: scan!.userId } }), 1)
    await ctx.close()
  })

  it("signed-in visitors skip sign-up and scan from the landing page directly", async () => {
    const { prisma } = await import("../services/prisma.js")
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(() => { localStorage.setItem("accesslens:cookie-notice", "1"); localStorage.setItem("accesslens:session", "1") })
    await ctx.request.post(`http://localhost:${PORT}/api/auth/login`, { headers: { Origin: `http://localhost:${PORT}` }, data: { email, password: "Sup3rSecret99" } })
    const page = await ctx.newPage()
    await page.goto(`http://localhost:${PORT}/`)
    await page.getByLabel("Website to audit").fill(`direct-${stamp}.example.com`)
    await page.getByRole("button", { name: /Scan website/ }).click()
    await page.waitForURL(/\/scans\/[0-9a-f-]{36}/, { timeout: 20_000 })
    assert.equal(await prisma.scan.count({ where: { userId: user.id, host: `direct-${stamp}.example.com` } }), 1)
    await ctx.close()
  })
})
