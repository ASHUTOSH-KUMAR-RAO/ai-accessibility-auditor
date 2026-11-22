import AxeBuilder from "@axe-core/playwright"
import type { BrowserContext, Page } from "playwright"
import { env } from "../../config/env.js"
import { logger } from "../../utils/logger.js"
import { getBrowser } from "./browser.js"
import { abortKind, ScanCancelled, ScanError } from "./errors.js"
import { EGRESS_REFUSED_HEADER, startEgressProxy, type EgressStats } from "./egress-proxy.js"
import type { StoredPassed, StoredReview } from "../report/types.js"
import type { Guard } from "./ssrf.js"
import { recordTabOrder, type TabOrder } from "./tab-order.js"

export const STAGES = {
  check: "Checking URL",
  load: "Loading page",
  axe: "Running accessibility checks",
  shot: "Capturing screenshot",
  score: "Calculating score",
} as const

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
const MAX_NODES_PER_RULE = 50 // stored sample per rule; the real total is still counted
const MAX_BOXES = 300
const MAX_SHOT_HEIGHT = 5000
const MAX_SHOT_BYTES = 500 * 1024
const VIEWPORTS = { DESKTOP: { width: 1280, height: 800 }, MOBILE: { width: 390, height: 844 } } as const

export type BoundingBox = { x: number; y: number; width: number; height: number }
export interface AxeNodeResult { selector: string; html: string; failureSummary: string; boundingBox: BoundingBox | null }
export interface AxeRuleResult {
  id: string
  impact: "critical" | "serious" | "moderate" | "minor"
  tags: string[]
  help: string
  description: string
  helpUrl: string
  /** Every affected element. `nodes` below is only the stored sample. */
  totalNodes: number
  nodes: AxeNodeResult[]
}
export interface PageScanResult {
  finalUrl: string
  pageTitle: string
  rules: AxeRuleResult[]
  passesCount: number
  incompleteCount: number
  screenshot: { data: Buffer; mime: string; width: number; height: number } | null
  /** data: URI of the page icon, fetched through the egress proxy (null if none / too big / blocked) */
  favicon: string | null
  /** axe "incomplete": needs a human look */
  review: StoredReview[]
  /** axe passes (id + help only) */
  passed: StoredPassed[]
  blockedRequests: number
  /** Keyboard focus order; null if recording failed (never fails the scan) */
  tabOrder: TabOrder | null
}

export interface ScanPageOptions {
  url: URL
  viewport: keyof typeof VIEWPORTS
  signal: AbortSignal
  guard: Guard
  /** Awaited; throws ScanCancelled if the scan was cancelled meanwhile. */
  onStage: (progress: number, stage: string) => Promise<void>
}

interface RunState {
  /** The page tried to navigate (top-level) to somewhere the guard refused. */
  blockedNavigation: boolean
  /** The main frame's navigation failed at the network level (refused by the proxy, DNS, connection…). */
  navFailed: boolean
  tooLarge: boolean
  /** Sub-requests refused by the route() pre-check. */
  blockedRequests: number
  /** What the egress proxy refused/failed (authoritative: it sees every connection, redirects included). */
  proxy: EgressStats
}

function userAgent(version: string, viewport: keyof typeof VIEWPORTS) {
  const major = version.split(".")[0]
  return viewport === "MOBILE"
    ? `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`
    : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

export async function scanPage(opts: ScanPageOptions): Promise<PageScanResult> {
  const { url, viewport, signal, guard, onStage } = opts
  const kind0 = abortKind(signal)
  if (kind0) throw mapFailure(new Error("aborted"), freshState(), signal)

  const browser = await getBrowser()
  const state = freshState()
  const closeRef: { fn: () => void } = { fn: () => {} }
  // Every connection Chromium makes goes through this proxy: redirects, sub-resources, iframes, DNS rebinding.
  const proxy = await startEgressProxy(guard, {
    maxBytes: env.SCAN_MAX_PAGE_BYTES,
    onTooLarge: () => {
      state.tooLarge = true
      closeRef.fn()
    },
  })
  state.proxy = proxy.stats
  // Fresh, isolated context per scan: no cookies, no storage, no service workers, no downloads.
  const context = await browser.newContext({
    proxy: { server: `http://127.0.0.1:${proxy.port}`, bypass: "<-loopback>" }, // "<-loopback>": do NOT skip the proxy for localhost
    viewport: VIEWPORTS[viewport],
    isMobile: viewport === "MOBILE",
    hasTouch: viewport === "MOBILE",
    userAgent: userAgent(browser.version(), viewport),
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
    acceptDownloads: false,
    serviceWorkers: "block",
    bypassCSP: true, // lets axe inject into pages with strict CSP; only affects this throw-away context
    ignoreHTTPSErrors: false,
    permissions: [],
  })

  const closeNow = () => void context.close().catch(() => {})
  closeRef.fn = closeNow
  signal.addEventListener("abort", closeNow, { once: true })

  try {
    await installGuards(context, guard, state)
    const page = await context.newPage()
    attachPageGuards(page, context, state)

    // ── Loading page ──
    await onStage(15, STAGES.load)
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: env.SCAN_NAV_TIMEOUT_MS })
    if (!response || state.navFailed) throw new ScanError(netFailureCode(state))
    if (response.headers()[EGRESS_REFUSED_HEADER]) throw new ScanError(netFailureCode(state)) // refused by our own egress proxy
    if (response.status() >= 400) {
      throw new ScanError("SITE_UNREACHABLE", `The website answered with an error (HTTP ${response.status()}), so there was nothing to scan.`)
    }
    const contentType = (await response.headerValue("content-type")) ?? ""
    if (!/html|xml/i.test(contentType)) throw new ScanError("INVALID_URL", "That address isn't a web page (it looks like a file or an image).")
    await onStage(30, STAGES.load)

    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {}) // best effort: chatty pages never go idle
    await page.waitForTimeout(750) // let SPAs settle
    assertHealthy(state, page)
    await guard.assertPublicUrl(new URL(page.url())) // JS redirects included
    await onStage(45, STAGES.load)

    // ── Axe ──
    await onStage(50, STAGES.axe)
    const axe = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .options({ resultTypes: ["violations", "incomplete"] }) // passes come back as cheap one-node summaries
      .analyze()
    assertHealthy(state, page)

    const rules = await collectRules(page, axe.violations)
    const review = collectReview(axe.incomplete)
    const passed = axe.passes.map((p) => ({ id: p.id, help: p.help, tags: p.tags }))
    await onStage(75, STAGES.axe)

    // ── Screenshot ──
    await onStage(80, STAGES.shot)
    const screenshot = await takeScreenshot(page, VIEWPORTS[viewport].width).catch((err) => {
      logger.warn("Screenshot failed; continuing without it", { reason: (err as Error).message })
      return null
    })
    const favicon = await fetchFavicon(page, context, guard)
    // Keyboard walk comes last: pressing Tab must not influence axe or the screenshot. It is best effort.
    const tabOrder = await recordTabOrder(page, { signal }).catch((err) => {
      logger.warn("Keyboard recording failed; continuing without it", { reason: (err as Error).message })
      return null
    })
    await onStage(90, STAGES.shot)

    assertHealthy(state, page)
    return {
      finalUrl: page.url(),
      pageTitle: (await page.title().catch(() => "")).trim().slice(0, 300),
      rules,
      passesCount: axe.passes.length,
      incompleteCount: axe.incomplete.length,
      screenshot,
      favicon,
      review,
      passed,
      blockedRequests: state.blockedRequests,
      tabOrder,
    }
  } catch (err) {
    throw mapFailure(err, state, signal)
  } finally {
    signal.removeEventListener("abort", closeNow)
    await context.close().catch(() => {})
    await proxy.close().catch(() => {})
  }
}

const freshState = (): RunState => ({ blockedNavigation: false, navFailed: false, tooLarge: false, blockedRequests: 0, proxy: { blocked: 0, dnsFailed: 0, bytes: 0 } })

function assertHealthy(state: RunState, page: Page) {
  if (state.blockedNavigation) throw new ScanError("BLOCKED_HOST")
  if (state.tooLarge) throw new ScanError("PAGE_TOO_LARGE")
  if (state.navFailed) throw new ScanError(netFailureCode(state))
  if (page.url().startsWith("chrome-error://")) throw new ScanError(netFailureCode(state))
}

/** The browser landed on an error page: ask the proxy why. */
function netFailureCode(state: RunState) {
  if (state.proxy.blocked > 0) return "BLOCKED_HOST" as const
  if (state.proxy.dnsFailed > 0) return "DNS_FAILED" as const
  return "SITE_UNREACHABLE" as const
}

/** Context-level guards: every request (incl. redirect hops and sub-resources) is re-checked, websockets are refused. */
async function installGuards(context: BrowserContext, guard: Guard, state: RunState) {
  await context.route("**/*", async (route) => {
    const request = route.request()
    try {
      let target: URL
      try {
        target = new URL(request.url())
      } catch {
        return await route.abort("blockedbyclient")
      }
      if (target.protocol === "data:" || target.protocol === "blob:") return await route.continue()
      if (request.resourceType() === "media") return await route.abort("blockedbyclient") // bandwidth, irrelevant to a11y rules

      try {
        await guard.assertPublicUrl(target)
      } catch {
        state.blockedRequests++
        // A blocked top-level navigation means the page tried to go somewhere internal: the whole scan fails.
        if (request.isNavigationRequest() && request.frame().parentFrame() === null) state.blockedNavigation = true
        return await route.abort("blockedbyclient")
      }
      await route.continue()
    } catch {
      // context closed mid-flight (cancel/timeout) or request already handled
    }
  })
  await context.routeWebSocket(/.*/, (ws) => void ws.close()) // never needed for a11y checks, and bypasses route()
}

function attachPageGuards(page: Page, context: BrowserContext, state: RunState) {
  page.on("requestfailed", (req) => {
    if (req.isNavigationRequest() && req.frame().parentFrame() === null) state.navFailed = true
  })
  page.on("dialog", (d) => void d.dismiss().catch(() => {}))
  page.on("download", (d) => void d.cancel().catch(() => {}))
  page.on("popup", (p) => void p.close().catch(() => {}))
  // New tabs opened by the page (window.open, target=_blank) are closed. Pages without an opener
  // are created by axe-core itself (it uses a blank helper page) and must stay.
  context.on("page", (p) => {
    void p.opener().then((opener) => opener && p.close()).catch(() => {})
  })
}

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number]

const MAX_REVIEW_NODES = 10
const FAVICON_MAX_BYTES = 16 * 1024
const FAVICON_TYPES = /^image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml)$/

function collectReview(incomplete: AxeViolation[]): StoredReview[] {
  return incomplete.map((v) => ({
    id: v.id,
    impact: (v.impact ?? null) as StoredReview["impact"],
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    tags: v.tags,
    totalNodes: v.nodes.length,
    nodes: v.nodes.slice(0, MAX_REVIEW_NODES).map((n) => ({
      selector: n.target.flat(2).join(" ").slice(0, 300),
      html: n.html.slice(0, 400),
      message: (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? "").slice(0, 300),
    })),
  }))
}

/**
 * The favicon is fetched here, through the same egress proxy as everything else (context.request honours the
 * context proxy), then inlined as a small data: URI. The viewer's browser never contacts the scanned site.
 */
async function fetchFavicon(page: Page, context: BrowserContext, guard: Guard): Promise<string | null> {
  try {
    const href = await page.evaluate(() => {
      const link = document.querySelector<HTMLLinkElement>('link[rel~="icon" i]')
      return link?.href || new URL("/favicon.ico", location.href).href
    })
    const url = new URL(href)
    await guard.assertPublicUrl(url)
    const res = await context.request.get(url.href, { timeout: 5_000, maxRedirects: 2, failOnStatusCode: false })
    if (res.status() !== 200) return null
    const type = (res.headers()["content-type"] ?? "").split(";")[0]!.trim().toLowerCase()
    if (!FAVICON_TYPES.test(type)) return null
    const body = await res.body()
    if (body.length === 0 || body.length > FAVICON_MAX_BYTES) return null
    return `data:${type};base64,${body.toString("base64")}`
  } catch {
    return null
  }
}

async function collectRules(page: Page, violations: AxeViolation[]): Promise<AxeRuleResult[]> {
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 } as const
  interface WorkNode extends AxeNodeResult { simple: string | null }

  const work = violations
    .map((v) => {
      const impact = (v.impact ?? "minor") as AxeRuleResult["impact"]
      const nodes: WorkNode[] = v.nodes.slice(0, MAX_NODES_PER_RULE).map((n) => ({
        selector: n.target.flat(2).join(" ").slice(0, 500),
        // Only plain top-document selectors can be re-queried for a bounding box (not iframe/shadow paths).
        simple: n.target.length === 1 && typeof n.target[0] === "string" ? n.target[0] : null,
        html: n.html.slice(0, 1000),
        failureSummary: (n.failureSummary ?? "").slice(0, 1000),
        boundingBox: null,
      }))
      const rule = { id: v.id, impact, tags: v.tags, help: v.help, description: v.description, helpUrl: v.helpUrl, totalNodes: v.nodes.length }
      return { rule, nodes }
    })
    .sort((x, y) => order[x.rule.impact] - order[y.rule.impact])

  // One round-trip measures every element: page coordinates (CSS px) so Phase 4 can overlay them on the screenshot.
  const measured = work.flatMap((w) => w.nodes).slice(0, MAX_BOXES)
  const boxes = await page
    .evaluate((sels) => {
      window.scrollTo(0, 0)
      return sels.map((s) => {
        if (!s) return null
        try {
          const el = document.querySelector(s)
          if (!el) return null
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) return null
          return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }
        } catch {
          return null
        }
      })
    }, measured.map((n) => n.simple))
    .catch(() => measured.map(() => null))
  measured.forEach((n, i) => (n.boundingBox = boxes[i] ?? null))

  return work.map(({ rule, nodes }) => ({ ...rule, nodes: nodes.map(({ simple: _simple, ...n }) => n) }))
}

/** Full-page JPEG, height capped, re-encoded at lower quality until it fits the size budget. */
async function takeScreenshot(page: Page, width: number): Promise<PageScanResult["screenshot"]> {
  const pageHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0))
  let height = Math.max(1, Math.min(pageHeight, MAX_SHOT_HEIGHT))
  for (const quality of [60, 40, 25]) {
    const data = await page.screenshot({
      type: "jpeg",
      quality,
      fullPage: true,
      clip: { x: 0, y: 0, width, height },
      animations: "disabled",
      timeout: 15_000,
    })
    if (data.length <= MAX_SHOT_BYTES) return { data, mime: "image/jpeg", width, height }
    height = Math.round(height * 0.7) // still too big: shorten the capture too
  }
  return null
}

/** Turn anything thrown into a ScanError / ScanCancelled with user-safe wording. Raw errors are only logged. */
export function mapFailure(err: unknown, state: RunState, signal: AbortSignal): ScanError | ScanCancelled {
  if (err instanceof ScanCancelled || err instanceof ScanError) {
    // a cancel/timeout can race with a half-finished check: the abort reason wins
    const kind = abortKind(signal)
    if (kind === "cancelled" || kind === "shutdown") return new ScanCancelled()
    return err
  }
  const kind = abortKind(signal)
  if (kind === "cancelled" || kind === "shutdown") return new ScanCancelled()
  if (kind === "timeout") return new ScanError("TIMEOUT")
  if (state.blockedNavigation) return new ScanError("BLOCKED_HOST")
  if (state.tooLarge) return new ScanError("PAGE_TOO_LARGE")

  const msg = err instanceof Error ? err.message : String(err)
  if (/Timeout \d+ms exceeded|ERR_TIMED_OUT/.test(msg)) return new ScanError("TIMEOUT")
  if (/Download is starting/.test(msg)) return new ScanError("INVALID_URL", "That address starts a file download instead of showing a web page.")
  if (/net::ERR_/.test(msg)) return new ScanError(netFailureCode(state)) // incl. proxy refusals (ERR_TUNNEL_CONNECTION_FAILED)
  logger.error("Unexpected scanner failure", { err })
  return new ScanError("SCAN_FAILED")
}

