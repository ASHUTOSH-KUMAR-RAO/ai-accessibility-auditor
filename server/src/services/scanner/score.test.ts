import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { calculateScore } from "./score.js"

describe("calculateScore", () => {
  it("is 100 with no violations", () => assert.equal(calculateScore([]), 100))

  it("matches the documented examples", () => {
    assert.equal(calculateScore([{ impact: "critical", nodes: 1 }]), 90)
    assert.equal(calculateScore([{ impact: "critical", nodes: 8 }]), 75)
    assert.equal(calculateScore([{ impact: "critical", nodes: 1 }, ...Array.from({ length: 5 }, () => ({ impact: "serious" as const, nodes: 1 }))]), 60)
    assert.equal(calculateScore(Array.from({ length: 20 }, () => ({ impact: "serious" as const, nodes: 1 }))), 0)
  })

  it("weights severity: critical > serious > moderate > minor", () => {
    const s = (impact: "critical" | "serious" | "moderate" | "minor") => calculateScore([{ impact, nodes: 1 }])
    assert.ok(s("critical") < s("serious") && s("serious") < s("moderate") && s("moderate") < s("minor") && s("minor") < 100)
  })

  it("more affected elements lowers the score, with diminishing steps", () => {
    const at = (nodes: number) => calculateScore([{ impact: "serious", nodes }])
    assert.ok(at(1) > at(2) && at(2) > at(4) && at(4) > at(100))
    assert.ok(at(1) - at(2) === at(2) - at(4) || Math.abs(at(1) - at(2) - (at(2) - at(4))) <= 1) // +0.5·W per doubling
  })

  it("is always an integer within 0..100, even for huge inputs", () => {
    const huge = calculateScore([{ impact: "critical", nodes: 1e9 }, ...Array.from({ length: 100 }, () => ({ impact: "critical" as const, nodes: 5000 }))])
    assert.equal(huge, 0)
    for (const n of [1, 3, 7, 50, 999]) {
      const v = calculateScore([{ impact: "moderate", nodes: n }, { impact: "minor", nodes: n }])
      assert.ok(Number.isInteger(v) && v >= 0 && v <= 100)
    }
  })

  it("ignores rules with no affected nodes", () => assert.equal(calculateScore([{ impact: "critical", nodes: 0 }]), 100))
})
