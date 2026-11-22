import AxeBuilder from "@axe-core/playwright"
import type { Browser } from "playwright"
import { env } from "../../config/env.js"
import { Semaphore } from "../../utils/semaphore.js"
import { logger } from "../../utils/logger.js"
import { getBrowser } from "../scanner/browser.js"
import { analyzeContrast, fontFromSummary } from "./contrast.js"
import { sanitizeHtml } from "./sanitize.js"
import type { Verification } from "./schemas.js"

/** Rules whose verdict depends on the rest of the page: a lone snippet cannot prove or disprove them. */
const NEEDS_PAGE = new Set([
  "document-title", "html-has-lang", "html-lang-valid", "html-xml-lang-mismatch", "meta-viewport", "meta-viewport-large", "bypass", "skip-link",
  "page-has-heading-one", "heading-order", "region", "landmark-one-main", "landmark-unique", "landmark-no-duplicate-banner", "landmark-no-duplicate-main",
  "landmark-no-duplicate-contentinfo", "landmark-banner-is-top-level", "landmark-main-is-top-level", "landmark-complementary-is-top-level",
  "landmark-contentinfo-is-top-level", "duplicate-id", "duplicate-id-active", "duplicate-id-aria", "scrollable-region-focusable", "frame-focusable-content",
  "listitem", "dlitem", "td-headers-attr", "th-has-data-cells", "aria-required-parent", "identical-links-same-purpose", "link-in-text-block", "target-size",
  "frame-title-unique",
])

const notApplicable = (note: string): Verification => ({ status: "NOT_APPLICABLE", note })

// Verification pages are tiny but still launch an isolated browser context: share the scanner's concurrency budget.
const slots = new Semaphore(env.SCAN_CONCURRENCY)

// axe itself needs JavaScript, so scripting cannot simply be switched off. Instead nothing the snippet contains can run
// or load: sanitised markup, a CSP of default-src 'none', every request aborted, and a dead proxy as a backstop.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
const page = (body: string, css = "") =>
  `<!doctype html><html lang="en"><head>${CSP}<meta charset="utf-8"><title>Verification</title><style>${css.replace(/<\/style/gi, "")}</style></head><body><main>${body}</main></body></html>`

interface RuleRun { violations: number; incomplete: number; failure: string }

async function runRule(browser: Browser, doc: string, ruleId: string): Promise<RuleRun> {
  const context = await browser.newContext({
    javaScriptEnabled: true,
    proxy: { server: "http://127.0.0.1:9" }, // nothing listens here: even a bypassed route() cannot reach a network
    serviceWorkers: "block",
    acceptDownloads: false,
    permissions: [],
    viewport: { width: 800, height: 600 },
  })
  try {
    await context.route("**/*", (route) => route.abort())
    const p = await context.newPage()
    await p.setContent(doc, { waitUntil: "domcontentloaded", timeout: 5000 })
    const res = await new AxeBuilder({ page: p }).withRules([ruleId]).analyze()
    const failure = res.violations
      .flatMap((v) => v.nodes.map((n) => n.failureSummary ?? ""))
      .join("\n")
      .slice(0, 500)
    return { violations: res.violations.length, incomplete: res.incomplete.length, failure }
  } finally {
    await context.close().catch(() => {})
  }
}

export interface VerifyInput {
  ruleId: string
  html: string
  fixedHtml: string | null
  cssFix: string | null
  failureSummary: string
}

/**
 * Re-runs the single axe rule on the original and on the fixed snippet, in isolation.
 * VERIFIED: the rule fails on the original and passes on the fix. NOT_VERIFIED: it still fails.
 * NOT_APPLICABLE: the rule needs the whole page, or the failure cannot be reproduced on a lone snippet.
 */
export async function verifyFix(input: VerifyInput): Promise<Verification & { axeFailure?: string }> {
  const { ruleId } = input
  if (NEEDS_PAGE.has(ruleId)) return notApplicable("This rule depends on the whole page, so a lone snippet can't be re-checked. Re-scan after applying it.")
  if (!input.fixedHtml?.trim()) return notApplicable("There is no changed markup to re-check.")

  let original = sanitizeHtml(input.html, 4000)
  let fixed = sanitizeHtml(input.fixedHtml, 4000)
  let css = ""
  if (ruleId === "color-contrast") {
    // The colours live in the page's stylesheet, so rebuild them around the element: "before" with the real colours, "after" with the computed ones.
    const c = analyzeContrast(input.failureSummary)
    const best = c?.suggestions[0]
    if (!c || !best) return notApplicable("The colours could not be read from the scan, so the fix can't be re-checked.")
    const font = fontFromSummary(input.failureSummary)
    const wrap = (fg: string, bg: string, inner: string) =>
      `<div style="background-color:${bg};color:${fg};font-size:${font.px}px;font-weight:${font.bold ? 700 : 400}">${inner}</div>`
    const fg = best.kind === "foreground" ? best.color : c.foreground
    const bg = best.kind === "background" ? best.color : c.background
    original = wrap(c.foreground, c.background, original)
    fixed = wrap(fg, bg, fixed)
  } else if (input.cssFix) {
    css = input.cssFix
  }

  try {
    return await slots.run(async () => {
      const browser = await getBrowser()
      const before = await runRule(browser, page(original), ruleId)
      if (before.violations === 0) return notApplicable("The problem could not be reproduced on this snippet alone (it probably depends on the surrounding page).")
      const after = await runRule(browser, page(fixed, css), ruleId)
      if (after.violations > 0) return { status: "NOT_VERIFIED" as const, note: "axe-core still reports this rule on the fixed snippet.", axeFailure: after.failure }
      if (after.incomplete > 0) return notApplicable("axe-core could not decide automatically: check this one by hand.")
      return { status: "VERIFIED" as const, note: "axe-core fails the original snippet and passes the fixed one." }
    })
  } catch (err) {
    logger.warn("Fix verification could not run", { ruleId, reason: (err as Error).message })
    return notApplicable("The automatic re-check could not run right now.")
  }
}
