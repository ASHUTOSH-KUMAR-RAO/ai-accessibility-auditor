import { AppError } from "../../utils/AppError.js"
import { prisma } from "../prisma.js"

export interface ExportRow {
  rule: string
  impact: string
  wcag: string
  description: string
  selector: string
  html: string
  failure: string
  helpUrl: string
}

const HEADERS: Array<[keyof ExportRow, string]> = [
  ["rule", "Rule"], ["impact", "Impact"], ["wcag", "WCAG criteria"], ["description", "Description"],
  ["selector", "Selector"], ["html", "HTML"], ["failure", "How to fix"], ["helpUrl", "Help URL"],
]

/**
 * One CSV cell. Always quoted. A cell that starts with = + - @ (or a tab/CR) would be run as a formula by Excel or Sheets,
 * and these values come from scanned pages, so it gets a leading apostrophe. (CSV injection)
 */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [HEADERS.map(([, h]) => csvCell(h)).join(",")]
  for (const r of rows) lines.push(HEADERS.map(([k]) => csvCell(r[k])).join(","))
  return "﻿" + lines.join("\r\n") + "\r\n" // BOM so Excel reads UTF-8
}

/** Issues of one scan, optionally limited to the rules the user currently sees (their filters). */
export async function exportIssues(userId: string, scanId: string, ruleIds?: string[]) {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, userId, deletedAt: null },
    select: { id: true, url: true, finalUrl: true, pageTitle: true, score: true, status: true, viewport: true, completedAt: true },
  })
  if (!scan) throw new AppError("Scan not found", 404, "NOT_FOUND")
  if (scan.status !== "COMPLETED") throw new AppError("This scan has no report yet.", 409, "NOT_COMPLETED")
  const issues = await prisma.issue.findMany({
    where: { scanId, ...(ruleIds && { ruleId: { in: ruleIds } }) },
    orderBy: [{ impact: "asc" }, { ruleId: "asc" }, { occurrenceIndex: "asc" }],
    select: { ruleId: true, impact: true, wcagCriteria: true, help: true, helpUrl: true, selector: true, html: true, failureSummary: true },
  })
  const rows: ExportRow[] = issues.map((i) => ({
    rule: i.ruleId,
    impact: i.impact.toLowerCase(),
    wcag: i.wcagCriteria.join(" "),
    description: i.help,
    selector: i.selector,
    html: i.html,
    failure: i.failureSummary.replace(/\s*\n\s*/g, " ").trim(),
    helpUrl: i.helpUrl,
  }))
  return { scan, rows }
}
