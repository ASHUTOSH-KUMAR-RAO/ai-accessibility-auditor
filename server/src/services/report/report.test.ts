import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { audiencesFor } from "./audiences.js"
import { buildReport, type ReportInput, type ReportIssueRow } from "./build-report.js"
import { gradeFor, GRADE_THRESHOLDS, verdictFor } from "./grade.js"
import type { StoredPassed, StoredReview, StoredRule } from "./types.js"
import { criteriaFor, criterionIds, levelFor, principleFor } from "./wcag.js"

describe("WCAG criteria mapping", () => {
  it("turns axe tags into criteria with names, levels, principles and Understanding links", () => {
    const [c] = criteriaFor(["cat.text-alternatives", "wcag2a", "wcag111"])
    assert.deepEqual({ id: c!.id, name: c!.name, level: c!.level, principle: c!.principle }, { id: "1.1.1", name: "Non-text Content", level: "A", principle: "perceivable" })
    assert.equal(c!.url, "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html")
  })

  it("parses multi-digit criterion numbers and ignores level tags", () => {
    assert.deepEqual(criterionIds(["wcag2aa", "wcag143", "wcag1412", "wcag2411", "wcag258", "wcag21aa", "best-practice"]), ["1.4.3", "1.4.12", "2.4.11", "2.5.8"])
  })

  it("builds the right W3C slugs for names with punctuation", () => {
    const url = (tag: string) => criteriaFor([tag])[0]!.url.split("/").pop()
    assert.equal(url("wcag143"), "contrast-minimum.html")
    assert.equal(url("wcag2411"), "focus-not-obscured-minimum.html")
    assert.equal(url("wcag412"), "name-role-value.html")
    assert.equal(url("wcag334"), "error-prevention-legal-financial-data.html")
    assert.equal(url("wcag121"), "audio-only-and-video-only-prerecorded.html")
  })

  it("maps the first digit to the four WCAG principles", () => {
    const p = (tag: string) => principleFor(criteriaFor([tag]))
    assert.deepEqual([p("wcag111"), p("wcag211"), p("wcag311"), p("wcag412")], ["perceivable", "operable", "understandable", "robust"])
  })

  it("rules without a WCAG criterion have no principle", () => assert.equal(principleFor(criteriaFor(["best-practice", "cat.aria"])), null))

  it("files a rule under its lowest WCAG level, or best-practice", () => {
    assert.equal(levelFor(["wcag2a", "wcag111"]), "A")
    assert.equal(levelFor(["wcag21aa", "wcag143"]), "AA")
    assert.equal(levelFor(["wcag22aa", "wcag258"]), "AA")
    assert.equal(levelFor(["wcag2a", "wcag2aa"]), "A")
    assert.equal(levelFor(["best-practice", "cat.structure"]), "best-practice")
    assert.equal(levelFor([]), "best-practice")
  })
})

describe("grade thresholds", () => {
  it("A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F, inclusive at the boundaries", () => {
    const cases: Array<[number, string]> = [[100, "A"], [90, "A"], [89, "B"], [80, "B"], [79, "C"], [70, "C"], [69, "D"], [60, "D"], [59, "F"], [0, "F"]]
    for (const [score, grade] of cases) assert.equal(gradeFor(score), grade, String(score))
  })
  it("rounds and clamps", () => {
    assert.equal(gradeFor(89.4), "B")
    assert.equal(gradeFor(89.6), "A")
    assert.equal(gradeFor(150), "A")
    assert.equal(gradeFor(-5), "F")
  })
  it("exposes the thresholds the UI shows", () => assert.deepEqual(GRADE_THRESHOLDS.map((t) => t.grade), ["A", "B", "C", "D", "F"]))
  it("verdict is one line and calls out critical elements only when there are some", () => {
    assert.ok(!verdictFor("A", 0).includes("critical"))
    assert.match(verdictFor("D", 1), /1 critical element\./)
    assert.match(verdictFor("F", 7), /7 critical elements\./)
    assert.ok(!verdictFor("B", 3).includes("\n"))
  })
})

describe("who is affected", () => {
  it("uses the maintained map for known rules", () => {
    assert.deepEqual(audiencesFor("color-contrast", []), ["low-vision", "color-blind", "cognitive"])
    assert.ok(audiencesFor("button-name", []).includes("screen-reader"))
  })
  it("falls back to the axe category tags for unknown rules", () => {
    assert.deepEqual(audiencesFor("some-new-rule", ["cat.keyboard"]), ["keyboard", "motor"])
    assert.deepEqual(audiencesFor("another-new-rule", ["cat.color", "cat.keyboard"]).sort(), ["cognitive", "color-blind", "keyboard", "low-vision", "motor"])
  })
  it("always names at least one audience", () => assert.deepEqual(audiencesFor("mystery", []), ["screen-reader"]))
})

// ───── buildReport ─────
const rule = (id: string, impact: StoredRule["impact"], tags: string[], totalNodes: number, storedNodes = totalNodes): StoredRule => ({ id, impact, help: `${id} help`, description: `${id} desc`, helpUrl: `https://x/${id}`, tags, totalNodes, storedNodes })
const issue = (ruleId: string, impact: ReportIssueRow["impact"], occurrenceIndex: number, withBox = true): ReportIssueRow => ({
  id: `${ruleId}-${occurrenceIndex}`, ruleId, impact, wcagTags: ["wcag2a"], help: `${ruleId} help`, description: "d", helpUrl: "u", occurrenceIndex,
  boundingBox: withBox ? { x: 1, y: 2, width: 3, height: 4 } : null,
})
const scan = { id: "s", url: "https://e.com", finalUrl: "https://e.com/", pageTitle: "T", favicon: null, viewport: "DESKTOP" as const, durationMs: 10, createdAt: new Date(), startedAt: null, completedAt: null, score: 64 }

const rules: StoredRule[] = [
  rule("color-contrast", "serious", ["cat.color", "wcag2aa", "wcag143"], 12, 12),
  rule("image-alt", "critical", ["cat.text-alternatives", "wcag2a", "wcag111"], 80, 50),
  rule("html-has-lang", "serious", ["cat.language", "wcag2a", "wcag311"], 1),
  rule("region", "moderate", ["cat.keyboard", "best-practice"], 5),
  rule("label", "critical", ["cat.forms", "wcag2a", "wcag412"], 3),
]
const issues: ReportIssueRow[] = [
  issue("color-contrast", "SERIOUS", 0), issue("image-alt", "CRITICAL", 1), issue("image-alt", "CRITICAL", 0), issue("label", "CRITICAL", 0, false),
  issue("region", "MODERATE", 0), issue("html-has-lang", "SERIOUS", 0),
]
const review: StoredReview[] = [
  { id: "color-contrast", impact: "serious", help: "h", description: "d", helpUrl: "u", tags: ["wcag2aa", "wcag143"], totalNodes: 2, nodes: [{ selector: "p", html: "<p>", message: "bg image" }] },
  { id: "aria-valid-attr-value", impact: null, help: "h2", description: "d", helpUrl: "u", tags: ["wcag2a", "wcag412"], totalNodes: 1, nodes: [] },
]
const passed: StoredPassed[] = [{ id: "document-title", help: "Documents must have <title>", tags: ["wcag2a", "wcag242"] }, { id: "bypass", help: "bypass", tags: ["wcag2a", "wcag241"] }]
const input = (over: Partial<ReportInput> = {}): ReportInput => ({ scan, rules, issues, review, passed, screenshot: { width: 1280, height: 900 }, ...over })

describe("buildReport", () => {
  const r = buildReport(input())

  it("orders rules by severity, then by most affected elements", () => {
    assert.deepEqual(r.rules.map((x) => x.id), ["image-alt", "label", "color-contrast", "html-has-lang", "region"])
  })

  it("uses the TRUE totals for counts, not just the stored sample", () => {
    const img = r.rules.find((x) => x.id === "image-alt")!
    assert.equal(img.totalNodes, 80)
    assert.equal(img.storedNodes, 50)
    assert.equal(img.approximate, false)
  })

  it("breaks down severity by rules and affected elements", () => {
    assert.deepEqual(r.severity, [
      { impact: "critical", rules: 2, elements: 83 },
      { impact: "serious", rules: 2, elements: 13 },
      { impact: "moderate", rules: 1, elements: 5 },
      { impact: "minor", rules: 0, elements: 0 },
    ])
  })

  it("breaks down by WCAG principle, with a bucket for best-practice rules", () => {
    const by = Object.fromEntries(r.principles.map((p) => [p.id, [p.rules, p.elements]]))
    assert.deepEqual(by, { perceivable: [2, 92], operable: [0, 0], understandable: [1, 1], robust: [1, 3], "best-practice": [1, 5] })
  })

  it("breaks down by level (A / AA / best-practice)", () => {
    const by = Object.fromEntries(r.levels.map((l) => [l.id, [l.rules, l.elements]]))
    assert.deepEqual(by, { A: [3, 84], AA: [1, 12], "best-practice": [1, 5] })
  })

  it("attaches criteria, principle, level and audiences to each rule", () => {
    const cc = r.rules.find((x) => x.id === "color-contrast")!
    assert.equal(cc.criteria[0]!.name, "Contrast (Minimum)")
    assert.equal(cc.principle, "perceivable")
    assert.equal(cc.level, "AA")
    assert.ok(cc.audiences.includes("low-vision"))
    assert.equal(r.rules.find((x) => x.id === "region")!.principle, null)
  })

  it("numbers markers in report order and skips elements without a position", () => {
    assert.deepEqual(r.markers.map((m) => [m.n, m.id]), [[1, "image-alt-0"], [2, "image-alt-1"], [3, "color-contrast-0"], [4, "html-has-lang-0"], [5, "region-0"]])
    assert.ok(!r.markers.some((m) => m.ruleId === "label"))
  })

  it("builds the Needs review and Passed lists", () => {
    assert.deepEqual(r.review.map((x) => x.id), ["color-contrast", "aria-valid-attr-value"]) // impact-less items last
    assert.match(r.review[0]!.guidance, /can't be measured/)
    assert.match(r.review[1]!.guidance, /ARIA value/)
    assert.deepEqual(r.passed.map((x) => x.id), ["bypass", "document-title"])
    assert.deepEqual(r.counts, { issues: 5, review: 2, passed: 2 })
  })

  it("derives grade and verdict from the score and critical elements", () => {
    assert.equal(r.scan.grade, "D")
    assert.match(r.scan.verdict, /83 critical elements/)
    assert.deepEqual(r.grading.map((g) => g.grade), ["A", "B", "C", "D", "F"])
  })

  it("old scans (no stored rule summaries) are rebuilt from the issue rows and flagged approximate", () => {
    const legacy = buildReport(input({ rules: null, review: [], passed: [] }))
    assert.equal(legacy.rules.length, 5)
    assert.ok(legacy.rules.every((x) => x.approximate))
    assert.equal(legacy.rules.find((x) => x.id === "image-alt")!.totalNodes, 2) // only the stored sample is known
    assert.deepEqual(legacy.counts, { issues: 5, review: 0, passed: 0 })
  })

  it("handles a clean page", () => {
    const clean = buildReport(input({ rules: [], issues: [], review: [], passed, scan: { ...scan, score: 100 } }))
    assert.equal(clean.scan.grade, "A")
    assert.deepEqual(clean.rules, [])
    assert.deepEqual(clean.severity.map((s) => s.elements), [0, 0, 0, 0])
    assert.ok(!clean.scan.verdict.includes("critical"))
  })
})
