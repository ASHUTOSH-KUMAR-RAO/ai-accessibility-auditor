// Integration test: drives real headless Chromium against a fixture site served by the test itself.
// Needs `npm run playwright:install` once. The fixture lives on 127.0.0.1, so the guard is told to exempt
// exactly that origin (test-only option, never reachable from env) while everything else stays blocked.
import assert from "node:assert/strict"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import "../../config/env.js"
import { closeBrowser } from "./browser.js"
import { ScanCancelled, ScanError } from "./errors.js"
import { scanPage, type PageScanResult } from "./scan-page.js"
import { createGuard } from "./ssrf.js"

const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

const BAD_PAGE = `<!doctype html><html><head><title>Fixture: broken page</title></head><body>
<img src="/pixel.png" width="120" height="60">
<a href="/x"></a>
<p style="color:#cccccc;background:#ffffff;font-size:16px">Barely readable text</p>
<input type="text" name="q">
<button></button>
<img src="http://127.0.0.2/internal.png" alt="">
</body></html>`

const GOOD_PAGE = `<!doctype html><html lang="en"><head><title>Fixture: good page</title></head><body>
<main><h1>Hello</h1><label for="q">Search</label><input id="q" type="text"><a href="/x">Read the docs</a></main></body></html>`

let server: Server
let port: number
let origin: string
const guard = () => createGuard({ allowOrigin: (u) => u.hostname === "127.0.0.1" && u.port === String(port) })

const scan = (path: string, opts: { viewport?: "DESKTOP" | "MOBILE"; signal?: AbortSignal } = {}): Promise<PageScanResult> =>
  scanPage({ url: new URL(origin + path), viewport: opts.viewport ?? "DESKTOP", signal: opts.signal ?? new AbortController().signal, guard: guard(), onStage: async () => {} })

const failure = async (p: Promise<unknown>) => {
  try {
    await p
    return "OK"
  } catch (e) {
    return e instanceof ScanError ? e.code : e instanceof ScanCancelled ? "CANCELLED" : `THROWN:${(e as Error).message}`
  }
}

before(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "/"
    if (url === "/pixel.png") return void res.writeHead(200, { "Content-Type": "image/png" }).end(PIXEL)
    if (url === "/") return void res.writeHead(200, { "Content-Type": "text/html" }).end(BAD_PAGE)
    if (url === "/good") return void res.writeHead(200, { "Content-Type": "text/html" }).end(GOOD_PAGE)
    if (url === "/redir-internal") return void res.writeHead(302, { Location: `http://127.0.0.2:${port}/secret` }).end()
    if (url === "/redir-metadata") return void res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" }).end()
    if (url === "/redir-ok") return void res.writeHead(302, { Location: "/good" }).end()
    if (url === "/js-redirect") return void res.writeHead(200, { "Content-Type": "text/html" }).end(`<!doctype html><title>x</title><script>setTimeout(()=>{location.href="http://127.0.0.2:${port}/js"},50)</script>`)
    if (url === "/missing") return void res.writeHead(404, { "Content-Type": "text/html" }).end("<h1>nope</h1>")
    if (url === "/file.pdf") return void res.writeHead(200, { "Content-Type": "application/pdf" }).end("%PDF-1.4")
    if (url === "/slow") return void res.writeHead(200, { "Content-Type": "text/html" }).write("<!doctype html><title>slow</title>") // never ends
    res.writeHead(404).end()
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  port = (server.address() as AddressInfo).port
  origin = `http://127.0.0.1:${port}`
})

after(async () => {
  await closeBrowser()
  server.closeAllConnections()
  server.close()
})

describe("scanPage against a fixture site", { timeout: 120_000 }, () => {
  it("finds the planted accessibility problems and measures them", async () => {
    const r = await scan("/")
    const ids = new Set(r.rules.map((x) => x.id))
    for (const expected of ["image-alt", "link-name", "button-name", "label", "html-has-lang", "color-contrast"]) {
      assert.ok(ids.has(expected), `expected rule ${expected}, got ${[...ids].join(", ")}`)
    }
    assert.equal(r.pageTitle, "Fixture: broken page")
    assert.equal(r.finalUrl, `${origin}/`)
    assert.ok(r.passesCount > 0)

    const imageAlt = r.rules.find((x) => x.id === "image-alt")!
    assert.equal(imageAlt.impact, "critical")
    assert.ok(imageAlt.nodes[0]!.selector.includes("img"))
    assert.ok(imageAlt.nodes[0]!.html.startsWith("<img"))
    const box = imageAlt.nodes[0]!.boundingBox
    assert.ok(box && box.width === 120 && box.height === 60, JSON.stringify(box))
    const order = ["critical", "serious", "moderate", "minor"]
    assert.deepEqual([...r.rules].sort((a, b) => order.indexOf(a.impact) - order.indexOf(b.impact)).map((x) => x.id), r.rules.map((x) => x.id), "sorted by severity")
  })

  it("captures a compressed JPEG screenshot within the size cap", async () => {
    const r = await scan("/")
    assert.ok(r.screenshot)
    assert.equal(r.screenshot.mime, "image/jpeg")
    assert.equal(r.screenshot.data[0], 0xff) // JPEG magic
    assert.ok(r.screenshot.data.length <= 500 * 1024)
    assert.equal(r.screenshot.width, 1280)
  })

  it("blocks sub-resources on internal hosts but still completes the scan", async () => {
    const r = await scan("/")
    assert.ok(r.blockedRequests >= 1, "the http://127.0.0.2 image must have been blocked")
  })

  it("uses the mobile viewport when asked", async () => {
    const r = await scan("/good", { viewport: "MOBILE" })
    assert.equal(r.screenshot?.width, 390)
  })

  it("an accessible page has no critical or serious violations", async () => {
    const r = await scan("/good")
    assert.deepEqual(r.rules.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => x.id), [])
  })

  it("follows a harmless redirect", async () => {
    const r = await scan("/redir-ok")
    assert.equal(r.finalUrl, `${origin}/good`)
  })

  it("refuses a redirect to a loopback address", async () => assert.equal(await failure(scan("/redir-internal")), "BLOCKED_HOST"))
  it("refuses a redirect to cloud metadata", async () => assert.equal(await failure(scan("/redir-metadata")), "BLOCKED_HOST"))
  it("refuses a JavaScript redirect to an internal host", async () => assert.equal(await failure(scan("/js-redirect")), "BLOCKED_HOST"))

  it("maps HTTP errors and non-HTML responses to friendly codes", async () => {
    assert.equal(await failure(scan("/missing")), "SITE_UNREACHABLE")
    assert.equal(await failure(scan("/file.pdf")), "INVALID_URL")
  })

  it("maps a closed port to SITE_UNREACHABLE", async () => {
    const dead = createServer()
    await new Promise<void>((r) => dead.listen(0, "127.0.0.1", r))
    const deadPort = (dead.address() as AddressInfo).port
    await new Promise<void>((r) => dead.close(() => r()))
    const g = createGuard({ allowOrigin: (u) => u.port === String(deadPort) })
    const p = scanPage({ url: new URL(`http://127.0.0.1:${deadPort}/`), viewport: "DESKTOP", signal: new AbortController().signal, guard: g, onStage: async () => {} })
    assert.equal(await failure(p), "SITE_UNREACHABLE")
  })

  it("cancels promptly when the signal fires mid-load", async () => {
    const ac = new AbortController()
    setTimeout(() => ac.abort("cancelled"), 700)
    const t0 = Date.now()
    assert.equal(await failure(scan("/slow", { signal: ac.signal })), "CANCELLED")
    assert.ok(Date.now() - t0 < 5000)
  })

  it("reports TIMEOUT when the overall deadline passes", async () => {
    const t0 = Date.now()
    const signal = AbortSignal.timeout(1200)
    assert.equal(await failure(scan("/slow", { signal })), "TIMEOUT")
    assert.ok(Date.now() - t0 < 6000)
  })
})
