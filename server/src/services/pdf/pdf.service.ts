import { createHash } from "node:crypto"
import { env } from "../../config/env.js"
import { Semaphore } from "../../utils/semaphore.js"
import { logger } from "../../utils/logger.js"
import { AppError } from "../../utils/AppError.js"
import { peekFix, type FixIssue } from "../ai/fix.service.js"
import { guidedFix } from "../ai/guided.js"
import { getSummaryForScan, ruleBasedSummary } from "../ai/summary.service.js"
import { prisma } from "../prisma.js"
import { reportForScan, screenshotForScan } from "../scan.service.js"
import { getBrowser } from "../scanner/browser.js"
import type { TabOrder } from "../scanner/tab-order.js"
import { PDF_VERSION, renderPdfHtml, type PdfData, type TopIssue } from "./pdf-template.js"

const TOP_RULES = 8
const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 } as const
const slots = new Semaphore(Math.max(1, Math.floor(env.SCAN_CONCURRENCY / 2))) // PDFs share the browser with scans: stay modest

const FOOTER = `<div style="width:100%;font:8px Arial,sans-serif;color:#5c5448;padding:0 16mm;display:flex;justify-content:space-between"><span>AccessLens accessibility report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`

/**
 * HTML → PDF in a locked-down context: no JavaScript, every request aborted, a dead proxy as a backstop.
 * The document is self-contained (data: URIs only), so nothing is ever fetched.
 */
export async function renderPdf(html: string): Promise<Buffer> {
  return slots.run(async () => {
    const context = await (await getBrowser()).newContext({
      javaScriptEnabled: false,
      proxy: { server: "http://127.0.0.1:9" },
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
    })
    try {
      await context.route("**/*", (route) => route.abort())
      const page = await context.newPage()
      await page.setContent(html, { waitUntil: "load", timeout: 15_000 })
      await page.emulateMedia({ media: "print" })
      return await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true, // accessible PDF: structure tree, real text
        outline: true, // bookmarks from headings
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: FOOTER,
        margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
      })
    } finally {
      await context.close().catch(() => {})
    }
  })
}

/** The finished HTML document and the fingerprint of everything it shows (exported for tests and previews). */
export async function buildPdfHtml(scanId: string) {
  const { data, fingerprint } = await gather(scanId)
  return { html: renderPdfHtml(data), fingerprint }
}

async function gather(scanId: string) {
  const report = await reportForScan(scanId)
  const stored = await getSummaryForScan(scanId)
  const summary = stored?.summary ?? ruleBasedSummary(report)

  const top = [...report.rules].sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || b.totalNodes - a.totalNodes).slice(0, TOP_RULES)
  const topIssues: TopIssue[] = []
  const fixKeys: string[] = []
  for (const rule of top) {
    const row = await prisma.issue.findFirst({
      where: { scanId, ruleId: rule.id },
      orderBy: { occurrenceIndex: "asc" },
      select: { id: true, ruleId: true, help: true, description: true, wcagTags: true, html: true, failureSummary: true, selector: true },
    })
    if (!row) continue
    const issue: FixIssue = row
    // Saved AI fixes only: no AI call is ever made for a PDF. Otherwise the deterministic guided fix.
    const saved = await peekFix(issue)
    if (saved) fixKeys.push(`${saved.id}@${saved.createdAt}`)
    const fix = saved ?? { source: "guided" as const, content: guidedFix({ ruleId: issue.ruleId, help: issue.help, html: issue.html, failureSummary: issue.failureSummary }), verification: { status: "NOT_APPLICABLE" as const, note: "" } }
    topIssues.push({ rule, selector: row.selector, html: row.html, fix })
  }

  const scanRow = await prisma.scan.findUnique({ where: { id: scanId }, select: { tabOrder: true } })
  const tabOrder = (scanRow?.tabOrder ?? null) as TabOrder | null
  const shotRow = report.screenshot ? await screenshotForScan(scanId).catch(() => null) : null
  const screenshot = shotRow && report.screenshot ? { dataUri: `data:${shotRow.mime};base64,${shotRow.buffer.toString("base64")}`, width: report.screenshot.width, height: report.screenshot.height } : null

  const data: PdfData = { report, summary, summarySource: stored?.source ?? "guided", topIssues, tabOrder, screenshot, generatedAt: new Date() }
  // Everything the PDF shows (except its creation date) feeds the fingerprint: a new AI fix or summary regenerates it.
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ v: PDF_VERSION, score: report.scan.score, rules: report.rules.map((r) => [r.id, r.totalNodes]), summary: stored?.createdAt ?? "rule-based", fixKeys, stops: tabOrder?.stops.length ?? -1, warnings: tabOrder?.warnings.length ?? -1, shot: !!screenshot }))
    .digest("hex")
  return { data, fingerprint }
}

export async function getReportPdf(userId: string, scanId: string): Promise<{ pdf: Buffer; filename: string; cached: boolean }> {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, userId, deletedAt: null }, select: { id: true, status: true, host: true, completedAt: true } })
  if (!scan) throw new AppError("Scan not found", 404, "NOT_FOUND")
  if (scan.status !== "COMPLETED") throw new AppError("This scan has no report yet.", 409, "NOT_COMPLETED")

  const { data, fingerprint } = await gather(scanId)
  const filename = `accesslens-${scan.host.replace(/[^a-z0-9.-]/gi, "_") || "report"}-${(scan.completedAt ?? new Date()).toISOString().slice(0, 10)}.pdf`
  const cached = await prisma.reportPdf.findUnique({ where: { scanId } })
  if (cached && cached.fingerprint === fingerprint) return { pdf: Buffer.from(cached.data), filename, cached: true }

  const pdf = await renderPdf(renderPdfHtml(data))
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new AppError("Could not create the PDF.", 500, "PDF_FAILED")
  await prisma.reportPdf
    .upsert({ where: { scanId }, create: { scanId, fingerprint, data: new Uint8Array(pdf) }, update: { fingerprint, data: new Uint8Array(pdf), createdAt: new Date() } })
    .catch((err) => logger.warn("Could not cache the PDF", { reason: (err as Error).message }))
  return { pdf, filename, cached: false }
}
