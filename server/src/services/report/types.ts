import type { Audience } from "./audiences.js"
import type { Criterion, Level, Principle, RuleLevel } from "./wcag.js"

export type ImpactName = "critical" | "serious" | "moderate" | "minor"
export const IMPACT_ORDER: ImpactName[] = ["critical", "serious", "moderate", "minor"]
export type Box = { x: number; y: number; width: number; height: number }

// ───── JSON shapes persisted on Scan (written by the runner, read by the report) ─────
export type StoredRule = {
  id: string
  impact: ImpactName
  help: string
  description: string
  helpUrl: string
  tags: string[]
  /** every affected element axe found */
  totalNodes: number
  /** how many of them were kept as Issue rows (capped) */
  storedNodes: number
}
export type StoredReview = {
  id: string
  impact: ImpactName | null
  help: string
  description: string
  helpUrl: string
  tags: string[]
  totalNodes: number
  nodes: Array<{ selector: string; html: string; message: string }>
}
export type StoredPassed = { id: string; help: string; tags: string[] }

// ───── API shape ─────
export interface ReportRule {
  id: string
  impact: ImpactName
  help: string
  description: string
  helpUrl: string
  criteria: Criterion[]
  principle: Principle | null
  level: RuleLevel
  audiences: Audience[]
  totalNodes: number
  storedNodes: number
  /** true for scans from before per-rule totals were stored: totalNodes is then only the stored sample */
  approximate: boolean
}
export interface ReportReview extends Omit<StoredReview, "tags"> {
  criteria: Criterion[]
  principle: Principle | null
  level: RuleLevel
  guidance: string
}
export interface ReportPassed { id: string; help: string; principle: Principle | null; level: RuleLevel }
export interface Marker { id: string; ruleId: string; impact: ImpactName; n: number; box: Box }

export interface Report {
  scan: {
    id: string
    url: string
    finalUrl: string | null
    pageTitle: string | null
    favicon: string | null
    viewport: "DESKTOP" | "MOBILE"
    durationMs: number | null
    createdAt: Date
    startedAt: Date | null
    completedAt: Date | null
    score: number
    grade: string
    verdict: string
  }
  grading: Array<{ grade: string; min: number }>
  severity: Array<{ impact: ImpactName; rules: number; elements: number }>
  principles: Array<{ id: Principle | "best-practice"; name: string; rules: number; elements: number }>
  levels: Array<{ id: RuleLevel; name: string; rules: number; elements: number }>
  rules: ReportRule[]
  review: ReportReview[]
  passed: ReportPassed[]
  counts: { issues: number; review: number; passed: number }
  screenshot: { width: number; height: number } | null
  markers: Marker[]
}

export type { Level }
