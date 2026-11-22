import { env } from "../../config/env.js"
import { logger } from "../../utils/logger.js"
import { prisma } from "../prisma.js"
import type { Report, ReportRule } from "../report/types.js"
import { getReport } from "../scan.service.js"
import { refund, spend } from "./budget.js"
import { effortFor, whyFor } from "./guided.js"
import { aiStatus, aiUsable, completeJson, LlmError } from "./llm.js"
import { summaryMessages } from "./prompts.js"
import { sanitizeText } from "./sanitize.js"
import { SUMMARY_JSON_SCHEMA, summaryOutputSchema, type Effort, type SummaryOutput } from "./schemas.js"
import type { FallbackReason } from "./fix.service.js"

export interface SummaryResult {
  summary: SummaryOutput
  source: "ai" | "guided"
  model: string | null
  cached: boolean
  fallbackReason: FallbackReason
  rateLimit: { limit: number; resetAt: string | null } | null
  createdAt: string
}

const AUDIENCE_LABEL: Record<string, string> = {
  "screen-reader": "screen-reader users",
  keyboard: "keyboard-only users",
  "low-vision": "people with low vision",
  "color-blind": "colour-blind people",
  cognitive: "people with cognitive disabilities",
  motor: "people with motor impairments",
}
const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 } as const
const byImportance = (a: ReportRule, b: ReportRule) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || b.totalNodes - a.totalNodes

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

/** Deterministic summary from the report numbers: used when the AI is unavailable, and always valid. */
export function ruleBasedSummary(report: Report): SummaryOutput {
  const rules = [...report.rules].sort(byImportance)
  const total = report.counts.issues
  if (rules.length === 0) {
    return {
      verdict: `${report.scan.verdict} The scan found no failing rules${report.counts.review ? `, but ${plural(report.counts.review, "item")} still need a manual check` : ""}.`,
      priorities: [{ ruleId: null, title: "Keep it that way", why: "Automated checks catch only part of the problems: test with a keyboard and a screen reader before each release.", effort: "medium" }],
      quickWins: [],
      mostAffected: "No group stands out from the automated checks.",
    }
  }
  const tally = new Map<string, number>()
  for (const r of rules) for (const a of r.audiences) tally.set(a, (tally.get(a) ?? 0) + r.totalNodes)
  const audiences = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => AUDIENCE_LABEL[a] ?? a)
  const effortOf = (r: ReportRule): Effort => effortFor(r.id)
  return {
    verdict: `${report.scan.verdict} ${plural(rules.length, "rule")} fail across ${plural(total, "element")}, scoring ${report.scan.score}/100 (grade ${report.scan.grade}).`,
    priorities: rules.slice(0, 3).map((r) => ({
      ruleId: r.id,
      title: `${r.help} (${plural(r.totalNodes, "element")})`,
      why: whyFor(r.id) ?? `${r.description}. This is a ${r.impact} issue.`,
      effort: effortOf(r),
    })),
    quickWins: rules.filter((r) => effortOf(r) === "quick").slice(0, 4).map((r) => `${r.help}: ${plural(r.totalNodes, "element")}`),
    mostAffected: audiences.length ? `Most affected: ${audiences.join(", ")}.` : "No group stands out from the automated checks.",
  }
}

async function generateWithAi(report: Report, signal: AbortSignal): Promise<SummaryOutput> {
  const rules = [...report.rules].sort(byImportance).slice(0, 15)
  const out = await completeJson(
    {
      model: env.GROQ_MODEL_SMART,
      maxTokens: 3000,
      signal,
      jsonSchema: { name: "scan_summary", schema: SUMMARY_JSON_SCHEMA },
      messages: summaryMessages({
        scan: {
          host: new URL(report.scan.finalUrl ?? report.scan.url).hostname,
          pageTitle: report.scan.pageTitle ? sanitizeText(report.scan.pageTitle, 120) : null,
          score: report.scan.score,
          grade: report.scan.grade,
          verdict: report.scan.verdict,
          viewport: report.scan.viewport,
        },
        counts: { failingRules: report.rules.length, failingElements: report.counts.issues, needsReview: report.counts.review, passedRules: report.counts.passed },
        rules: rules.map((r) => ({ ruleId: r.id, impact: r.impact, help: r.help, elements: r.totalNodes, criteria: r.criteria.map((c) => c.id), audiences: r.audiences })),
      }),
    },
    summaryOutputSchema,
  )
  const known = new Set(report.rules.map((r) => r.id))
  return { ...out, priorities: out.priorities.map((p) => ({ ...p, ruleId: p.ruleId && known.has(p.ruleId) ? p.ruleId : null })) }
}

const reasonNow = (): FallbackReason => (!aiStatus().configured ? "no_key" : "limited")

function toResult(row: { result: unknown; model: string; fallback: boolean; createdAt: Date }, cached: boolean, fallbackReason: FallbackReason, rateLimit: SummaryResult["rateLimit"] = null): SummaryResult {
  return { summary: row.result as SummaryOutput, source: row.fallback ? "guided" : "ai", model: row.fallback ? null : row.model, cached, fallbackReason: row.fallback ? fallbackReason : null, rateLimit, createdAt: row.createdAt.toISOString() }
}

/** The stored summary, if any (never calls the AI). */
export async function getSummary(userId: string, scanId: string): Promise<SummaryResult | null> {
  return summaryWhere({ scanId, scan: { userId, deletedAt: null } })
}
/** Same, for callers that already proved access to the scan (share link, PDF). */
export const getSummaryForScan = (scanId: string) => summaryWhere({ scanId, scan: { deletedAt: null } })

async function summaryWhere(where: { scanId: string; scan: object }): Promise<SummaryResult | null> {
  const row = await prisma.aiSummary.findFirst({ where })
  return row ? toResult(row, true, row.fallback ? reasonNow() : null) : null
}

/** Cached per scan. `regenerate` forces a new answer (costs one AI generation). */
export async function generateSummary(userId: string, scanId: string, opts: { regenerate: boolean; signal: AbortSignal }): Promise<SummaryResult> {
  const existing = await getSummary(userId, scanId) // also proves the scan is theirs
  if (existing && !opts.regenerate) return existing
  const report = await getReport(userId, scanId) // 404 / 409 handled here

  let summary: SummaryOutput | null = null
  let reason: FallbackReason = null
  let rateLimit: SummaryResult["rateLimit"] = null
  let model: string | null = null
  if (!aiUsable()) reason = reasonNow()
  else {
    const spent = await spend(userId)
    if (!spent.ok) {
      reason = "rate_limited"
      rateLimit = { limit: spent.limit, resetAt: spent.resetAt }
    } else {
      try {
        summary = await generateWithAi(report, opts.signal)
        model = env.GROQ_MODEL_SMART
      } catch (err) {
        await refund(spent.usageId).catch(() => {})
        if (err instanceof LlmError && err.kind === "aborted") throw err
        reason = "failed"
        logger.warn("AI summary failed, using the rule-based one", { kind: err instanceof LlmError ? err.kind : "unexpected" })
      }
    }
  }
  // A regenerate that could not reach the AI must not overwrite a good AI summary with a rule-based one.
  if (!summary && existing && existing.source === "ai") return { ...existing, fallbackReason: reason, rateLimit }
  const fallback = !summary
  const data = { result: JSON.parse(JSON.stringify(summary ?? ruleBasedSummary(report))), model: model ?? "guided", fallback, createdAt: new Date() }
  const row = await prisma.aiSummary.upsert({ where: { scanId }, create: { scanId, ...data }, update: data })
  return toResult(row, false, reason, rateLimit)
}
