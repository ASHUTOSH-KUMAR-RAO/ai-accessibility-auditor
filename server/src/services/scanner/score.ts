export type Impact = "critical" | "serious" | "moderate" | "minor"

/**
 * ACCESSIBILITY SCORE (0–100)
 *
 *   score = clamp( 100 − Σ over failing rules of  W[impact] × (1 + 0.5 × log2(nodes)) , 0, 100 )
 *
 *   W = { critical: 10, serious: 6, moderate: 3, minor: 1 }
 *
 * - A rule counts once at full weight (W) no matter how small the problem is.
 * - More affected elements raise that rule's penalty slowly (+0.5·W each time the count doubles),
 *   so one rule with 400 broken images can't zero the page on its own, but still hurts more than 1 image.
 * - Rules that pass cost nothing; a page with no violations scores 100.
 * - The result is rounded to an integer and never leaves 0–100.
 *
 * Examples: 1 critical rule on 1 element → 90 · 1 critical on 8 elements → 75 ·
 *           1 critical + 5 serious (1 element each) → 60 · 20 serious rules → 0.
 */
export const IMPACT_WEIGHT: Record<Impact, number> = { critical: 10, serious: 6, moderate: 3, minor: 1 }

export interface RuleFailure {
  impact: Impact
  /** Number of affected elements (all of them, not just the stored sample). */
  nodes: number
}

export function calculateScore(failures: RuleFailure[]): number {
  let penalty = 0
  for (const f of failures) {
    if (f.nodes <= 0) continue
    penalty += IMPACT_WEIGHT[f.impact] * (1 + 0.5 * Math.log2(f.nodes))
  }
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}
