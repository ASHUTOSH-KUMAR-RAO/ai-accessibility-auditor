import { createHash } from "node:crypto"
import { env } from "../../config/env.js"
import type { AiFix } from "../../generated/prisma/client.js"
import { logger } from "../../utils/logger.js"
import { prisma } from "../prisma.js"
import { criteriaByIds, criteriaFor, type Criterion } from "../report/wcag.js"
import { refund, spend } from "./budget.js"
import { analyzeContrast, type ContrastInfo } from "./contrast.js"
import { effortFor, guidedFix } from "./guided.js"
import { aiStatus, aiUsable, completeJson, explanationStreamer, LlmError } from "./llm.js"
import { fixMessages } from "./prompts.js"
import { sanitizeHtml, sanitizeText } from "./sanitize.js"
import { FIX_JSON_SCHEMA, fixOutputSchema, PROMPT_VERSION, type FixContent, type FixOutput, type Verification } from "./schemas.js"
import { verifyFix } from "./verify.js"

export interface FixIssue {
  id: string
  ruleId: string
  help: string
  description: string
  wcagTags: string[]
  html: string
  failureSummary: string
}

/** Why the answer is a guided fix and not an AI one (null = it is AI). */
export type FallbackReason = "no_key" | "limited" | "rate_limited" | "failed" | null

export interface FixResult {
  /** AiFix id: used for feedback */
  id: string
  source: "ai" | "guided"
  model: string | null
  cached: boolean
  fallbackReason: FallbackReason
  rateLimit: { limit: number; resetAt: string | null } | null
  /** The cleaned snippet the fix was written against (scripts, handlers and long data removed): the honest "before" for a diff */
  original: string
  content: FixContent
  criteria: Criterion[]
  verification: Verification
  contrast: ContrastInfo | null
  createdAt: string
}

interface Outcome { content: FixContent; verification: Verification; source: "ai" | "guided"; model: string | null }
interface Prepared { html: string; failureSummary: string; contrast: ContrastInfo | null }

export function cacheKey(ruleId: string, html: string, failureSummary: string, model = env.GROQ_MODEL_FAST) {
  return createHash("sha256").update([ruleId, html.replace(/\s+/g, " ").trim(), failureSummary, model, PROMPT_VERSION].join("\0")).digest("hex")
}

function prepare(issue: FixIssue): Prepared {
  const failureSummary = sanitizeText(issue.failureSummary)
  return {
    html: sanitizeHtml(issue.html),
    failureSummary,
    contrast: issue.ruleId === "color-contrast" ? analyzeContrast(failureSummary) : null,
  }
}

async function check(issue: FixIssue, p: Prepared, content: FixContent) {
  return verifyFix({ ruleId: issue.ruleId, html: p.html, fixedHtml: content.fixedHtml, cssFix: content.cssFix, failureSummary: p.failureSummary })
}

function toContent(out: FixOutput, issue: FixIssue, p: Prepared): FixContent {
  // Colours come from the maths, never from the model: its CSS and HTML are replaced for contrast issues.
  const fromMath = p.contrast ? guidedFix({ ruleId: issue.ruleId, help: issue.help, html: p.html, failureSummary: p.failureSummary }) : null
  return {
    explanation: out.explanation.trim(),
    fixedHtml: fromMath ? p.html : out.fixedHtml,
    cssFix: fromMath ? fromMath.cssFix : out.cssFix?.trim() || null,
    jsx: fromMath ? null : out.jsx?.trim() || null,
    steps: out.steps,
    test: out.test,
    wcag: out.wcag ?? [],
    confidence: out.confidence,
    effort: effortFor(issue.ruleId),
  }
}

async function generateWithAi(issue: FixIssue, p: Prepared, signal: AbortSignal, onDelta?: (t: string) => void): Promise<Outcome> {
  const rule = { id: issue.ruleId, help: issue.help, description: sanitizeText(issue.description, 400), criteria: criteriaFor(issue.wcagTags).map((c) => c.id) }
  const ask = (model: string, previous?: { fixedHtml: string; axeFailure: string }, delta?: (t: string) => void) =>
    completeJson(
      { model, maxTokens: 2500, signal, jsonSchema: { name: "accessibility_fix", schema: FIX_JSON_SCHEMA }, messages: fixMessages({ rule, element: { html: p.html, failureSummary: p.failureSummary }, contrast: p.contrast, previous }), onDelta: delta },
      fixOutputSchema,
    )

  // The small model sometimes drops keys: when it fails twice the stronger one gets a go before we give up on the AI.
  let model = env.GROQ_MODEL_FAST
  let first: FixOutput
  try {
    first = await ask(model, undefined, onDelta && explanationStreamer(onDelta))
  } catch (err) {
    if (!(err instanceof LlmError && err.kind === "bad_output")) throw err
    model = env.GROQ_MODEL_SMART
    first = await ask(model)
  }
  const content = toContent(first, issue, p)
  const verified = await check(issue, p, content)
  const firstOutcome: Outcome = { content, verification: { status: verified.status, note: verified.note }, source: "ai", model }
  if (verified.status !== "NOT_VERIFIED") return firstOutcome

  // axe says the fix still fails: give the stronger model one more try, showing it the axe failure.
  try {
    const second = await ask(env.GROQ_MODEL_SMART, { fixedHtml: first.fixedHtml, axeFailure: verified.axeFailure ?? "" })
    const retryContent = toContent(second, issue, p)
    const retryCheck = await check(issue, p, retryContent)
    if (retryCheck.status === "VERIFIED") return { content: retryContent, verification: { status: "VERIFIED", note: "The first attempt failed the axe re-check; the retry passes." }, source: "ai", model: env.GROQ_MODEL_SMART }
  } catch (err) {
    if (err instanceof LlmError && err.kind === "aborted") throw err
    logger.warn("AI retry after failed verification did not work", { ruleId: issue.ruleId })
  }
  return firstOutcome // best effort, honestly labelled NOT_VERIFIED
}

async function generateGuided(issue: FixIssue, p: Prepared): Promise<Outcome> {
  const content = guidedFix({ ruleId: issue.ruleId, help: issue.help, html: p.html, failureSummary: p.failureSummary })
  const v = await check(issue, p, content)
  return { content, verification: { status: v.status, note: v.note }, source: "guided", model: null }
}

function toResult(row: AiFix, issue: FixIssue, cached: boolean, fallbackReason: FallbackReason, rateLimit: FixResult["rateLimit"] = null): FixResult {
  const stored = row.result as unknown as { content: FixContent; contrast: ContrastInfo | null }
  const ids = [...criteriaFor(issue.wcagTags).map((c) => c.id), ...stored.content.wcag]
  return {
    id: row.id,
    source: row.fallback ? "guided" : "ai",
    model: row.fallback ? null : row.model,
    cached,
    fallbackReason: row.fallback ? fallbackReason : null,
    rateLimit,
    original: sanitizeHtml(issue.html),
    content: stored.content,
    criteria: criteriaByIds(ids),
    verification: { status: row.verification, note: row.verificationNote ?? "" },
    contrast: stored.contrast,
    createdAt: row.createdAt.toISOString(),
  }
}

/** A saved answer for this element, if one exists. Never calls the AI and never spends budget. */
export async function peekFix(issue: FixIssue): Promise<FixResult | null> {
  const p = prepare(issue)
  const row = await prisma.aiFix.findUnique({ where: { cacheKey: cacheKey(issue.ruleId, p.html, p.failureSummary) } })
  return row ? toResult(row, issue, true, null) : null
}

export interface GenerateOptions {
  signal: AbortSignal
  /** decoded pieces of the explanation as the model writes it */
  onDelta?: (text: string) => void
  /** called once we know the answer will be generated (not served from cache) */
  onGenerating?: () => void
}

export async function generateFix(userId: string, issue: FixIssue, opts: GenerateOptions): Promise<FixResult> {
  const p = prepare(issue)
  const key = cacheKey(issue.ruleId, p.html, p.failureSummary)
  const reasonNow = (): FallbackReason => (!aiStatus().configured ? "no_key" : "limited")

  const cached = await prisma.aiFix.findUnique({ where: { cacheKey: key } })
  // AI answers are shared across scans and users and never expire. Guided answers are only reused while the AI is down.
  if (cached && (!cached.fallback || !aiUsable())) return toResult(cached, issue, true, reasonNow())

  opts.onGenerating?.()
  let outcome: Outcome | null = null
  let usageId: string | null = null
  let reason: FallbackReason = null
  let rateLimit: FixResult["rateLimit"] = null

  if (!aiUsable()) reason = reasonNow()
  else {
    const spent = await spend(userId)
    if (!spent.ok) {
      reason = "rate_limited"
      rateLimit = { limit: spent.limit, resetAt: spent.resetAt }
    } else {
      usageId = spent.usageId
      try {
        outcome = await generateWithAi(issue, p, opts.signal, opts.onDelta)
      } catch (err) {
        await refund(spent.usageId).catch(() => {})
        if (err instanceof LlmError && err.kind === "aborted") throw err
        reason = "failed"
        logger.warn("AI fix failed, using the guided fix", { ruleId: issue.ruleId, kind: err instanceof LlmError ? err.kind : "unexpected" })
      }
    }
  }
  outcome ??= await generateGuided(issue, p)
  if (usageId && outcome.source === "ai") await prisma.aiUsage.update({ where: { id: usageId }, data: { verification: outcome.verification.status } }).catch(() => {})

  const data = {
    ruleId: issue.ruleId,
    model: outcome.model ?? "guided",
    promptVersion: PROMPT_VERSION,
    fallback: outcome.source === "guided",
    result: JSON.parse(JSON.stringify({ content: outcome.content, contrast: p.contrast })),
    verification: outcome.verification.status,
    verificationNote: outcome.verification.note,
  }
  const row = await prisma.aiFix
    .upsert({ where: { cacheKey: key }, create: { cacheKey: key, ...data }, update: { ...data, createdAt: new Date() } })
    .catch(async (err) => {
      if ((err as { code?: string }).code !== "P2002") throw err // two requests created the same row at once: use theirs
      return prisma.aiFix.findUniqueOrThrow({ where: { cacheKey: key } })
    })
  return toResult(row, issue, false, reason, rateLimit)
}
