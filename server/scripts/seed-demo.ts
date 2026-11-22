// Creates (or resets) the demo account with scans of three sites over several weeks, so trends, compare and
// the dashboard have something to show, plus cached AI fixes for every seeded element.
//   npm run seed:demo            (refuses in production unless you pass --force)
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import bcrypt from "bcryptjs"
import "../src/config/env.js"
import { isProd } from "../src/config/env.js"
import { PROMPT_VERSION } from "../src/services/ai/schemas.js"
import { prisma } from "../src/services/prisma.js"
import { calculateScore } from "../src/services/scanner/score.js"
import { criterionIds } from "../src/services/report/wcag.js"

export const DEMO_EMAIL = "demo@accesslens.dev"
export const DEMO_PASSWORD = "AccessLens-Demo-2026"
const DAY = 86_400_000

if (isProd && !process.argv.includes("--force")) {
  console.error("Refusing to seed demo data in production. Pass --force if you really mean it.")
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const sample = JSON.parse(readFileSync(resolve(here, "../seed/sample.json"), "utf8")) as {
  rules: Array<{ id: string; impact: "critical" | "serious" | "moderate" | "minor"; help: string; description: string; helpUrl: string; tags: string[]; totalNodes: number; storedNodes: number }>
  review: unknown
  passed: unknown
  tabOrder: unknown
  screenshot: { width: number; height: number } | null
  issues: Array<Record<string, unknown> & { ruleId: string; impact: "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR"; occurrenceIndex: number }>
  fixes: Array<{ ruleId: string; cacheKey: string; model: string; fallback: boolean; result: unknown; verification: "VERIFIED" | "NOT_VERIFIED" | "NOT_APPLICABLE"; note: string }>
}
const shot = await import("node:fs").then((fs) => (sample.screenshot ? fs.readFileSync(resolve(here, "../seed/sample.webp")) : null))

/** How many weeks ago each scan ran, and how much of the sample's problems is still present (fraction of each rule's elements; rules missing from `keep` are fixed). */
interface Step { daysAgo: number; keep: Record<string, number>; viewport?: "DESKTOP" | "MOBILE" }
const ALL = Object.fromEntries(sample.rules.map((r) => [r.id, 1]))
const without = (...ids: string[]) => Object.fromEntries(Object.entries(ALL).filter(([id]) => !ids.includes(id)))
const scale = (f: number, ...ids: string[]) => ({ ...ALL, ...Object.fromEntries(ids.map((i) => [i, f])) })

const SITES: Array<{ host: string; title: string; steps: Step[] }> = [
  {
    host: "citylights.example.com",
    title: "CityLights: the new portal for visitors and residents",
    steps: [
      { daysAgo: 42, keep: ALL },
      { daysAgo: 28, keep: scale(0.6, "image-alt", "link-name") },
      { daysAgo: 14, keep: { ...without("html-has-lang", "landmark-one-main", "select-name"), "image-alt": 0.4, "link-name": 0.5 } },
      { daysAgo: 3, keep: { ...without("html-has-lang", "landmark-one-main", "select-name", "region"), "image-alt": 0.15, "link-name": 0.3 } },
    ],
  },
  {
    host: "shop.example.com",
    title: "Northwind Shop: everyday goods",
    steps: [
      { daysAgo: 35, keep: { ...scale(0.7, "image-alt"), ...without("landmark-one-main") } },
      { daysAgo: 20, keep: { ...without("landmark-one-main", "html-has-lang"), "image-alt": 0.5, "color-contrast": 1 } },
      { daysAgo: 6, keep: { ...without("landmark-one-main", "html-has-lang", "select-name"), "image-alt": 0.55, "color-contrast": 1, region: 1 }, viewport: "MOBILE" },
    ],
  },
  {
    host: "docs.example.org",
    title: "Example Docs: guides and API reference",
    steps: [
      { daysAgo: 21, keep: { "image-alt": 0.2, region: 0.5, "link-name": 0.15 } },
      { daysAgo: 2, keep: { region: 0.25 } },
    ],
  },
]

function variant(keep: Record<string, number>) {
  const rules = sample.rules
    .filter((r) => (keep[r.id] ?? 0) > 0)
    .map((r) => {
      const stored = Math.max(1, Math.round(r.storedNodes * keep[r.id]!))
      // true totals scale like the stored sample so "N of M elements" stays believable
      return { ...r, storedNodes: stored, totalNodes: Math.max(stored, Math.round(r.totalNodes * keep[r.id]!)) }
    })
  const issues = rules.flatMap((r) => sample.issues.filter((i) => i.ruleId === r.id).slice(0, r.storedNodes))
  return { rules, issues }
}

await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } }) // cascades: scans, usage, feedback
const user = await prisma.user.create({ data: { name: "Demo User", email: DEMO_EMAIL, password: await bcrypt.hash(DEMO_PASSWORD, 12) } })

let scans = 0
for (const site of SITES) {
  for (const step of site.steps) {
    const { rules, issues } = variant(step.keep)
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const r of rules) counts[r.impact] += r.totalNodes
    const when = new Date(Date.now() - step.daysAgo * DAY)
    const scan = await prisma.scan.create({
      data: {
        userId: user.id, url: `https://${site.host}/`, normalizedUrl: `https://${site.host}/`, finalUrl: `https://${site.host}/`, host: site.host,
        status: "COMPLETED", progress: 100, stage: "Completed", viewport: step.viewport ?? "DESKTOP", pageTitle: site.title,
        score: calculateScore(rules.map((r) => ({ impact: r.impact, nodes: r.totalNodes }))),
        criticalCount: counts.critical, seriousCount: counts.serious, moderateCount: counts.moderate, minorCount: counts.minor,
        passesCount: 30 + (rules.length ? 0 : 6), incompleteCount: 1, durationMs: 9_000 + Math.round(Math.random() * 6000),
        rules, reviewItems: sample.review as never, passedRules: sample.passed as never, tabOrder: (sample.tabOrder ?? undefined) as never,
        createdAt: when, startedAt: when, completedAt: new Date(+when + 11_000),
      },
    })
    for (let i = 0; i < issues.length; i += 200) {
      await prisma.issue.createMany({ data: issues.slice(i, i + 200).map((x) => ({ ...(x as object), scanId: scan.id, wcagCriteria: criterionIds((x.wcagTags as string[]) ?? []) })) as never })
    }
    if (shot && sample.screenshot) await prisma.scanScreenshot.create({ data: { scanId: scan.id, data: new Uint8Array(shot), mime: "image/webp", width: sample.screenshot.width, height: sample.screenshot.height, bytes: shot.length } })
    scans++
  }
}

// Cached AI fixes: same cache keys the live app computes, so "Fix with AI" on these elements is instant and free.
for (const f of sample.fixes) {
  const data = { ruleId: f.ruleId, model: f.model, promptVersion: PROMPT_VERSION, fallback: f.fallback, result: f.result as never, verification: f.verification, verificationNote: f.note }
  await prisma.aiFix.upsert({ where: { cacheKey: f.cacheKey }, create: { cacheKey: f.cacheKey, ...data }, update: data })
}
const verified = sample.fixes.filter((f) => !f.fallback && f.verification === "VERIFIED").length
await prisma.aiUsage.createMany({ data: Array.from({ length: verified * 2 }, (_, i) => ({ userId: user.id, verification: "VERIFIED" as const, createdAt: new Date(Date.now() - (i + 2) * DAY * 2) })) })

console.log(`Demo account ready: ${scans} scans across ${SITES.length} sites, ${sample.fixes.length} cached AI fixes.`)
console.log(`  email:    ${DEMO_EMAIL}\n  password: ${DEMO_PASSWORD}`)
await prisma.$disconnect()
