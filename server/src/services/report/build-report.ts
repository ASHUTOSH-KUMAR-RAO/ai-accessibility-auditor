import { audiencesFor } from "./audiences.js"
import { GRADE_THRESHOLDS, gradeFor, verdictFor } from "./grade.js"
import { IMPACT_ORDER, type Box, type ImpactName, type Marker, type Report, type ReportPassed, type ReportReview, type ReportRule, type StoredPassed, type StoredReview, type StoredRule } from "./types.js"
import { criteriaFor, levelFor, PRINCIPLES, principleFor, type RuleLevel } from "./wcag.js"

export interface ReportIssueRow {
  id: string
  ruleId: string
  impact: "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR"
  wcagTags: string[]
  help: string
  description: string
  helpUrl: string
  boundingBox: unknown
  occurrenceIndex: number
}

export interface ReportInput {
  scan: Omit<Report["scan"], "grade" | "verdict">
  /** null for scans created before per-rule totals were stored */
  rules: StoredRule[] | null
  issues: ReportIssueRow[]
  review: StoredReview[]
  passed: StoredPassed[]
  screenshot: { width: number; height: number } | null
}

const lower = (i: ReportIssueRow["impact"]) => i.toLowerCase() as ImpactName
const rank = (i: ImpactName) => IMPACT_ORDER.indexOf(i)

const REVIEW_GUIDANCE: Record<string, string> = {
  "color-contrast": "The text sits on an image, gradient or overlapping element, so the contrast can't be measured automatically. Check the text is readable against its real background (4.5:1, or 3:1 for large text).",
  "color-contrast-enhanced": "The background can't be measured automatically. Check the text is easy to read against what is really behind it.",
  "aria-valid-attr-value": "An ARIA value points at something axe can't verify (for example an id that may be added later). Confirm the referenced element exists when the page is in use.",
  "link-in-text-block": "Check that links inside text are recognisable without relying on colour alone (underline, weight or another visual cue).",
  "scrollable-region-focusable": "Check that scrolling areas can be reached and scrolled with the keyboard alone.",
  "video-caption": "Play the video and check that accurate captions are available.",
  "audio-caption": "Check that a transcript or captions are available for the audio.",
  "frame-tested": "An iframe couldn't be tested. Run an accessibility check inside that frame's page as well.",
  "autocomplete-valid": "Check that the autocomplete value matches what the field really asks for.",
}

export const reviewGuidance = (id: string, help: string) =>
  REVIEW_GUIDANCE[id] ?? `axe couldn't decide this one automatically. Inspect the element and check it by hand against: "${help}".`

/** Rules for scans stored before per-rule summaries existed: rebuilt from the Issue rows (only the stored sample is known). */
function deriveRules(issues: ReportIssueRow[]): StoredRule[] {
  const byRule = new Map<string, StoredRule>()
  for (const i of issues) {
    const r = byRule.get(i.ruleId)
    if (r) {
      r.totalNodes++
      r.storedNodes++
    } else {
      byRule.set(i.ruleId, { id: i.ruleId, impact: lower(i.impact), help: i.help, description: i.description, helpUrl: i.helpUrl, tags: i.wcagTags, totalNodes: 1, storedNodes: 1 })
    }
  }
  return [...byRule.values()]
}

const asBox = (v: unknown): Box | null => {
  if (!v || typeof v !== "object") return null
  const b = v as Record<string, unknown>
  return ["x", "y", "width", "height"].every((k) => typeof b[k] === "number") ? (v as Box) : null
}

/** Pure: turns stored scan data into the report the UI renders. */
export function buildReport(input: ReportInput): Report {
  const approximate = input.rules === null
  const stored = input.rules ?? deriveRules(input.issues)

  const rules: ReportRule[] = stored
    .map((r) => {
      const criteria = criteriaFor(r.tags)
      return {
        id: r.id,
        impact: r.impact,
        help: r.help,
        description: r.description,
        helpUrl: r.helpUrl,
        criteria,
        principle: principleFor(criteria),
        level: levelFor(r.tags),
        audiences: audiencesFor(r.id, r.tags),
        totalNodes: r.totalNodes,
        storedNodes: r.storedNodes,
        approximate,
      }
    })
    .sort((a, b) => rank(a.impact) - rank(b.impact) || b.totalNodes - a.totalNodes || a.id.localeCompare(b.id))

  const severity = IMPACT_ORDER.map((impact) => {
    const of = rules.filter((r) => r.impact === impact)
    return { impact, rules: of.length, elements: of.reduce((n, r) => n + r.totalNodes, 0) }
  })

  const principles = [
    ...PRINCIPLES.map((p) => ({ id: p.id as Report["principles"][number]["id"], name: p.name })),
    { id: "best-practice" as const, name: "Best practice (no WCAG principle)" },
  ].map((p) => {
    const of = rules.filter((r) => (r.principle ?? "best-practice") === p.id)
    return { ...p, rules: of.length, elements: of.reduce((n, r) => n + r.totalNodes, 0) }
  })

  const levelNames: Array<[RuleLevel, string]> = [["A", "Level A"], ["AA", "Level AA"], ["best-practice", "Best practice"]]
  const levels = levelNames.map(([id, name]) => {
    const of = rules.filter((r) => r.level === id)
    return { id, name, rules: of.length, elements: of.reduce((n, r) => n + r.totalNodes, 0) }
  })

  // Marker numbers follow the order of the stored issues (severity, rule, occurrence) and only count elements with a position.
  const markers: Marker[] = []
  const ordered = [...input.issues].sort((a, b) => rank(lower(a.impact)) - rank(lower(b.impact)) || a.ruleId.localeCompare(b.ruleId) || a.occurrenceIndex - b.occurrenceIndex)
  for (const i of ordered) {
    const box = asBox(i.boundingBox)
    if (box) markers.push({ id: i.id, ruleId: i.ruleId, impact: lower(i.impact), n: markers.length + 1, box })
  }

  const review: ReportReview[] = input.review
    .map(({ tags, ...r }) => {
      const criteria = criteriaFor(tags)
      return { ...r, criteria, principle: principleFor(criteria), level: levelFor(tags), guidance: reviewGuidance(r.id, r.help) }
    })
    .sort((a, b) => (a.impact ? rank(a.impact) : 9) - (b.impact ? rank(b.impact) : 9) || b.totalNodes - a.totalNodes || a.id.localeCompare(b.id))

  const passed: ReportPassed[] = input.passed
    .map((p) => ({ id: p.id, help: p.help, principle: principleFor(criteriaFor(p.tags)), level: levelFor(p.tags) }))
    .sort((a, b) => a.id.localeCompare(b.id))

  const grade = gradeFor(input.scan.score)
  return {
    scan: { ...input.scan, grade, verdict: verdictFor(grade, severity[0]!.elements) },
    grading: GRADE_THRESHOLDS,
    severity,
    principles,
    levels,
    rules,
    review,
    passed,
    counts: { issues: rules.length, review: review.length, passed: passed.length },
    screenshot: input.screenshot,
    markers,
  }
}
