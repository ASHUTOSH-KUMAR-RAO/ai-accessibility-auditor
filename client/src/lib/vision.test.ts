// Run with: npm test (node's built-in runner executes TypeScript directly)
import assert from "node:assert/strict"
import { test } from "node:test"
import { ACHROMATOPSIA, applyMatrix, MACHADO, matrixValues, VISION_TYPES } from "./vision.ts"

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`)

test("Machado (2009) severity-1.0 matrices have the published values", () => {
  assert.deepEqual(MACHADO.protanopia.slice(0, 3), [0.152286, 1.052583, -0.204868])
  assert.deepEqual(MACHADO.deuteranopia.slice(3, 6), [0.280085, 0.672501, 0.047413])
  assert.deepEqual(MACHADO.tritanopia.slice(6, 9), [0.004733, 0.691367, 0.3039])
})

test("every row sums to 1, so white and greys stay neutral", () => {
  for (const m of [...Object.values(MACHADO), ACHROMATOPSIA]) {
    for (const row of [0, 3, 6]) close(m[row]! + m[row + 1]! + m[row + 2]!, 1, 2e-3)
    const [r, g, b] = applyMatrix(m, [1, 1, 1])
    close(r, 1, 2e-3)
    close(g, 1, 2e-3)
    close(b, 1, 2e-3)
    const grey = applyMatrix(m, [0.4, 0.4, 0.4])
    for (const c of grey) close(c, 0.4, 2e-3)
  }
})

test("pure red under protanopia becomes a dark olive (known result)", () => {
  const [r, g, b] = applyMatrix(MACHADO.protanopia, [1, 0, 0])
  close(r, 0.152286)
  close(g, 0.114503)
  close(b, -0.003882)
})

test("protanopia and deuteranopia put red and green on the same chromaticity (they differ only in brightness)", () => {
  const chroma = (c: [number, number, number]) => c[0] / (c[0] + c[1] + c[2])
  for (const m of [MACHADO.protanopia, MACHADO.deuteranopia]) {
    close(chroma(applyMatrix(m, [1, 0, 0])), chroma(applyMatrix(m, [0, 1, 0])), 0.05)
  }
  // normal vision: red and green are completely different chromaticities
  assert.ok(Math.abs(chroma([1, 0, 0]) - chroma([0, 1, 0])) === 1)
})

test("achromatopsia maps any colour to a grey equal to its luminance", () => {
  const [r, g, b] = applyMatrix(ACHROMATOPSIA, [1, 0, 0])
  close(r, 0.2126)
  close(g, 0.2126)
  close(b, 0.2126)
})

test("feColorMatrix values: 20 numbers, alpha row untouched", () => {
  const v = matrixValues(MACHADO.deuteranopia).trim().split(/\s+/).map(Number)
  assert.equal(v.length, 20)
  assert.deepEqual(v.slice(15), [0, 0, 0, 1, 0])
})

test("every simulated type has a plain-language explanation and a prevalence", () => {
  assert.equal(VISION_TYPES.length, 6)
  for (const t of VISION_TYPES) assert.ok(t.what.length > 20 && t.prevalence.length > 10 && t.tip.length > 10, t.id)
})
