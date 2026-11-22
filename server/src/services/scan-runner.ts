import { env } from "../config/env.js"
import { logger } from "../utils/logger.js"
import { publishScan } from "./scan-dto.js"
import type { ClaimedScan } from "./scan-queue.js"
import { prisma } from "./prisma.js"
import { emitToUser } from "./realtime.js"
import { abortKind, ScanCancelled, ScanError } from "./scanner/errors.js"
import { calculateScore } from "./scanner/score.js"
import { scanPage, STAGES, type AxeRuleResult } from "./scanner/scan-page.js"
import { defaultGuard, type Guard } from "./scanner/ssrf.js"
import type { StoredRule } from "./report/types.js"
import { criterionIds } from "./report/wcag.js"

const MAX_ISSUES = 1500

const impactEnum = (i: AxeRuleResult["impact"]) => i.toUpperCase() as "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR"

/** Runs one claimed scan end to end. Owns every status transition after the claim. */
export async function runScan(scan: ClaimedScan, parentSignal: AbortSignal, guard: Guard = defaultGuard): Promise<void> {
  const started = Date.now()
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(env.SCAN_TOTAL_TIMEOUT_MS)])

  const report = async (progress: number, stage: string) => {
    // Doubles as the cancel check: if the row is no longer RUNNING somebody cancelled it.
    const { count } = await prisma.scan.updateMany({ where: { id: scan.id, status: "RUNNING" }, data: { progress, stage, heartbeatAt: new Date() } })
    if (count === 0) throw new ScanCancelled()
    emitToUser(scan.userId, "scan:progress", { id: scan.id, status: "RUNNING", progress, stage })
  }

  try {
    await report(5, STAGES.check)
    const { url } = guard.normalize(scan.normalizedUrl)
    await guard.assertPublicUrl(url) // DNS + deny-list before any browser work

    const page = await scanPage({ url, viewport: scan.viewport, signal, guard, onStage: report })

    await report(92, STAGES.score)
    const score = calculateScore(page.rules.map((r) => ({ impact: r.impact, nodes: r.totalNodes })))
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const r of page.rules) counts[r.impact] += r.totalNodes

    const issues = page.rules
      .flatMap((r) =>
        r.nodes.map((n, occurrenceIndex) => ({
          scanId: scan.id,
          ruleId: r.id,
          impact: impactEnum(r.impact),
          wcagTags: r.tags,
          wcagCriteria: criterionIds(r.tags),
          help: r.help,
          description: r.description,
          helpUrl: r.helpUrl,
          selector: n.selector,
          html: n.html,
          failureSummary: n.failureSummary,
          boundingBox: n.boundingBox ?? undefined,
          occurrenceIndex,
        })),
      )
      .slice(0, MAX_ISSUES)

    // Per-rule summary with TRUE totals (the Issue rows are only a capped sample)
    const storedByRule = new Map<string, number>()
    for (const i of issues) storedByRule.set(i.ruleId, (storedByRule.get(i.ruleId) ?? 0) + 1)
    const ruleSummaries: StoredRule[] = page.rules.map((r) => ({
      id: r.id, impact: r.impact, help: r.help, description: r.description, helpUrl: r.helpUrl, tags: r.tags,
      totalNodes: r.totalNodes, storedNodes: storedByRule.get(r.id) ?? 0,
    }))

    await prisma.$transaction(
      async (tx) => {
        const done = await tx.scan.updateMany({
          where: { id: scan.id, status: "RUNNING" }, // a cancel that landed meanwhile wins; nothing is stored
          data: {
            status: "COMPLETED",
            progress: 100,
            stage: "Completed",
            score,
            criticalCount: counts.critical,
            seriousCount: counts.serious,
            moderateCount: counts.moderate,
            minorCount: counts.minor,
            passesCount: page.passesCount,
            incompleteCount: page.incompleteCount,
            pageTitle: page.pageTitle || null,
            finalUrl: page.finalUrl,
            favicon: page.favicon,
            rules: ruleSummaries,
            reviewItems: page.review,
            passedRules: page.passed,
            durationMs: Date.now() - started,
            completedAt: new Date(),
          },
        })
        if (done.count === 0) throw new ScanCancelled()
        for (let i = 0; i < issues.length; i += 500) await tx.issue.createMany({ data: issues.slice(i, i + 500) })
        if (page.screenshot) {
          const { data, mime, width, height } = page.screenshot
          await tx.scanScreenshot.create({ data: { scanId: scan.id, data: new Uint8Array(data), mime, width, height, bytes: data.length } })
        }
      },
      { timeout: 30_000 },
    )
    await publishScan(scan.userId, "scan:completed", scan.id)
  } catch (err) {
    await settle(scan, err, signal, started)
  }
}

/** Turns whatever happened into the right terminal state. Never throws. */
async function settle(scan: ClaimedScan, err: unknown, signal: AbortSignal, started: number) {
  try {
    const kind = abortKind(signal)
    if (kind === "shutdown") {
      // Server is stopping: hand the job back so another instance (or the next boot) picks it up.
      await prisma.scan.updateMany({ where: { id: scan.id, status: "RUNNING" }, data: { status: "QUEUED", progress: 0, stage: null, startedAt: null, heartbeatAt: null } })
      return
    }
    if (err instanceof ScanCancelled || kind === "cancelled") {
      await prisma.scan.updateMany({ where: { id: scan.id, status: "RUNNING" }, data: { status: "CANCELLED", completedAt: new Date(), stage: "Cancelled" } })
      await publishScan(scan.userId, "scan:cancelled", scan.id)
      return
    }

    let failure: ScanError
    if (err instanceof ScanError) failure = err
    else if (kind === "timeout") failure = new ScanError("TIMEOUT")
    else {
      logger.error("Scan crashed", { err, scanId: scan.id })
      failure = new ScanError("SCAN_FAILED")
    }
    const { count } = await prisma.scan.updateMany({
      where: { id: scan.id, status: "RUNNING" },
      data: { status: "FAILED", errorCode: failure.code, errorMessage: failure.message, durationMs: Date.now() - started, completedAt: new Date() },
    })
    if (count) await publishScan(scan.userId, "scan:failed", scan.id)
  } catch (inner) {
    logger.error("Could not record scan outcome", { err: inner, scanId: scan.id })
  }
}
