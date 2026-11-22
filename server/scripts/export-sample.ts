// Developer tool: freezes ONE finished scan into a static demo that needs no login and no database.
//   npx tsx scripts/export-sample.ts <scanId>
// Writes client/public/demo/* (served as static files by /sample) and server/seed/* (used by `npm run seed:demo`).
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { loadIssueForScan } from "../src/services/ai/ai.service.js"
import { generateFix, cacheKey } from "../src/services/ai/fix.service.js"
import { sanitizeHtml, sanitizeText } from "../src/services/ai/sanitize.js"
import { generateSummary, getSummaryForScan } from "../src/services/ai/summary.service.js"
import { prisma } from "../src/services/prisma.js"
import { nodesForScan, reportForScan, screenshotForScan } from "../src/services/scan.service.js"

const here = dirname(fileURLToPath(import.meta.url))
const clientDir = resolve(here, "../../client/public/demo")
const seedDir = resolve(here, "../seed")
const scanId = process.argv[2]
if (!scanId) throw new Error("usage: tsx scripts/export-sample.ts <scanId>")

const write = (dir: string, file: string, data: unknown) => {
  const path = resolve(dir, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data))
}

async function toWebp(image: Buffer, mime: string, maxKb: number): Promise<Buffer> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    let q = 0.8
    for (;;) {
      const b64 = await page.evaluate(async ([data, type, quality]) => {
        const img = new Image()
        img.src = `data:${type};base64,${data}`
        await img.decode()
        const c = document.createElement("canvas")
        c.width = img.width
        c.height = img.height
        c.getContext("2d")!.drawImage(img, 0, 0)
        return c.toDataURL("image/webp", quality as number).split(",")[1]!
      }, [image.toString("base64"), mime, q] as const)
      const out = Buffer.from(b64, "base64")
      if (out.length <= maxKb * 1024 || q <= 0.3) return out
      q -= 0.1
    }
  } finally {
    await browser.close()
  }
}

const ac = new AbortController()
const scan = await prisma.scan.findUniqueOrThrow({ where: { id: scanId }, select: { userId: true, tabOrder: true, host: true, rules: true, reviewItems: true, passedRules: true, pageTitle: true, url: true } })
const report = await reportForScan(scanId)

// ── every stored element of every rule ──
const nodes: Record<string, Awaited<ReturnType<typeof nodesForScan>>["items"]> = {}
for (const r of report.rules) nodes[r.id] = (await nodesForScan(scanId, r.id, { limit: 100 })).items
const issues = await prisma.issue.findMany({ where: { scanId }, orderBy: [{ impact: "asc" }, { ruleId: "asc" }, { occurrenceIndex: "asc" }] })

// ── fixes for the first 3 elements of each rule: saved AI fixes, otherwise generated now (spends the owner's hourly budget) ──
const fixes: Array<{ issueId: string; ruleId: string; html: string; failureSummary: string; fix: Awaited<ReturnType<typeof generateFix>> }> = []
for (const r of report.rules) {
  for (const n of nodes[r.id]!.slice(0, 3)) {
    const issue = await loadIssueForScan(scanId, n.id)
    const fix = await generateFix(scan.userId, issue, { signal: ac.signal })
    fixes.push({ issueId: n.id, ruleId: r.id, html: issue.html, failureSummary: issue.failureSummary, fix })
    process.stdout.write(`${fix.source === "ai" ? "AI    " : "guided"} ${fix.verification.status.padEnd(15)} ${r.id}\n`)
  }
}
const summary = (await getSummaryForScan(scanId)) ?? (await generateSummary(scan.userId, scanId, { regenerate: false, signal: ac.signal }))

const shot = await screenshotForScan(scanId).catch(() => null)
const webp = shot ? await toWebp(shot.buffer, shot.mime, 170) : null

// ── static demo for the client ──
const demoReport = { ...report, scan: { ...report.scan, id: "sample", favicon: null } }
write(clientDir, "report.json", { report: demoReport, share: { expiresAt: null, hideScreenshot: !webp } })
for (const r of report.rules) write(clientDir, `rules/${r.id}.json`, { items: nodes[r.id], nextCursor: null })
for (const f of fixes) write(clientDir, `fixes/${f.issueId}.json`, { fix: f.fix })
write(clientDir, "ai-summary.json", { summary })
write(clientDir, "keyboard.json", { available: scan.tabOrder !== null, tabOrder: scan.tabOrder })
if (webp) write(clientDir, "screenshot.webp", webp)

// ── seed material for the demo account ──
write(seedDir, "sample.json", {
  host: scan.host, url: scan.url, pageTitle: scan.pageTitle, rules: scan.rules, review: scan.reviewItems, passed: scan.passedRules, tabOrder: scan.tabOrder,
  screenshot: webp ? { width: report.screenshot!.width, height: report.screenshot!.height } : null,
  issues: issues.map(({ id: _id, scanId: _s, ...i }) => i),
  fixes: fixes.map((f) => ({ ruleId: f.ruleId, cacheKey: cacheKey(f.ruleId, sanitizeHtml(f.html), sanitizeText(f.failureSummary)), model: f.fix.model ?? "guided", fallback: f.fix.source === "guided", result: { content: f.fix.content, contrast: f.fix.contrast }, verification: f.fix.verification.status, note: f.fix.verification.note })),
})
if (webp) write(seedDir, "sample.webp", webp)
console.log(`exported ${report.rules.length} rules, ${issues.length} elements, ${fixes.length} fixes, screenshot ${webp ? Math.round(webp.length / 1024) + " KB" : "none"}`)
await prisma.$disconnect()
