export type Grade = "A" | "B" | "C" | "D" | "F"

/** Lower bound (inclusive) of each grade. Shown to users, so keep it in one place. */
export const GRADE_THRESHOLDS: Array<{ grade: Grade; min: number }> = [
  { grade: "A", min: 90 },
  { grade: "B", min: 80 },
  { grade: "C", min: 70 },
  { grade: "D", min: 60 },
  { grade: "F", min: 0 },
]

export function gradeFor(score: number): Grade {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  return GRADE_THRESHOLDS.find((t) => s >= t.min)!.grade
}

const BASE: Record<Grade, string> = {
  A: "Excellent: this page passes nearly every check we run.",
  B: "Good, with a few issues worth fixing.",
  C: "Fair: real barriers remain for some visitors.",
  D: "Poor: many visitors will struggle with this page.",
  F: "Failing: serious barriers keep some people out entirely.",
}

/** One plain-English line for the hero. Mentions critical problems because those are what to fix first. */
export function verdictFor(grade: Grade, critical: number): string {
  if (critical === 0) return BASE[grade]
  return `${BASE[grade]} Start with the ${critical} critical element${critical === 1 ? "" : "s"}.`
}
