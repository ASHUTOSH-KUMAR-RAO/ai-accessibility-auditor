// Deterministic WCAG contrast maths. The AI never picks colours: it only explains the numbers computed here.

export type RGB = [number, number, number]

export function parseColor(input: string): RGB | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length <= 4) h = [...h].map((c) => c + c).join("")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB // alpha (if any) is ignored
}

export const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")

const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h * 60, s, l]
}
function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/**
 * The colour closest to `color` (same hue and saturation, only lightness moves) that reaches `target` against `against`.
 * Both directions are tried because the nearest passing shade can be lighter or darker.
 */
export function nearestPassing(color: RGB, against: RGB, target: number): RGB | null {
  if (contrastRatio(color, against) >= target) return color
  const [h, s, l0] = toHsl(color)
  let best: { rgb: RGB; delta: number } | null = null
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 200; step++) {
      const l = l0 + (dir * step) / 200
      if (l < 0 || l > 1) break
      const rgb = parseColor(toHex(fromHsl(h, s, l)))! // judge the colour the user will actually get after rounding
      if (contrastRatio(rgb, against) >= target) {
        if (!best || step / 200 < best.delta) best = { rgb, delta: step / 200 }
        break
      }
    }
  }
  return best?.rgb ?? null
}

export interface ContrastInfo {
  foreground: string
  background: string
  ratio: number
  required: number
  largeText: boolean
  aa: boolean
  aaa: boolean
  suggestions: Array<{ kind: "foreground" | "background"; color: string; ratio: number; aa: boolean; aaa: boolean }>
}

/** axe: "…(foreground color: #777, background color: #fff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1" */
export function parseContrastSummary(summary: string): { fg: RGB; bg: RGB; fontPx: number | null; bold: boolean; required: number | null } | null {
  const fg = /foreground color:\s*(#[0-9a-f]{3,8})/i.exec(summary)?.[1]
  const bg = /background color:\s*(#[0-9a-f]{3,8})/i.exec(summary)?.[1]
  const fgRgb = fg ? parseColor(fg) : null
  const bgRgb = bg ? parseColor(bg) : null
  if (!fgRgb || !bgRgb) return null
  const px = /\((\d+(?:\.\d+)?)px\)/.exec(summary)?.[1]
  const weight = /font weight:\s*(\w+)/i.exec(summary)?.[1]?.toLowerCase()
  const required = /Expected contrast ratio of (\d+(?:\.\d+)?):1/i.exec(summary)?.[1]
  return {
    fg: fgRgb,
    bg: bgRgb,
    fontPx: px ? Number(px) : null,
    bold: weight === "bold" || weight === "bolder" || Number(weight) >= 700,
    required: required ? Number(required) : null,
  }
}

/** Large text = 24px+, or 18.66px+ when bold (WCAG: 18pt / 14pt bold). */
export const isLargeText = (px: number | null, bold: boolean) => px !== null && (px >= 24 || (bold && px >= 18.66))

const round2 = (n: number) => Math.floor(n * 100) / 100 // never show a failing 4.49 as a "passing" 4.5

export function analyzeContrast(failureSummary: string): ContrastInfo | null {
  const p = parseContrastSummary(failureSummary)
  if (!p) return null
  const largeText = isLargeText(p.fontPx, p.bold)
  const aaTarget = largeText ? 3 : 4.5
  const aaaTarget = largeText ? 4.5 : 7
  const required = p.required ?? aaTarget
  const ratio = contrastRatio(p.fg, p.bg)
  const describe = (kind: "foreground" | "background", c: RGB) => {
    const r = kind === "foreground" ? contrastRatio(c, p.bg) : contrastRatio(p.fg, c)
    return { kind, color: toHex(c), ratio: round2(r), aa: r >= aaTarget, aaa: r >= aaaTarget }
  }
  const suggestions: ContrastInfo["suggestions"] = []
  const fg = nearestPassing(p.fg, p.bg, Math.max(required, aaTarget))
  if (fg) suggestions.push(describe("foreground", fg))
  const bg = nearestPassing(p.bg, p.fg, Math.max(required, aaTarget))
  if (bg) suggestions.push(describe("background", bg))
  return { foreground: toHex(p.fg), background: toHex(p.bg), ratio: round2(ratio), required, largeText, aa: ratio >= aaTarget, aaa: ratio >= aaaTarget, suggestions }
}

/** Font facts for the verification page, from the same summary. */
export function fontFromSummary(summary: string) {
  const p = parseContrastSummary(summary)
  return { px: p?.fontPx ?? 16, bold: p?.bold ?? false }
}
