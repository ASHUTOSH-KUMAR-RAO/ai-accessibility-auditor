const GRADE_COLOR: Record<string, string> = { A: "#1b6b46", B: "#2f6a1b", C: "#86560a", D: "#b3470d", F: "#a3123a" } // white text >= 5:1 on each
const GREY = "#57534e"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const width = (s: string) => Math.round(s.length * 6.6 + 14) // Verdana 11px, good enough for short ASCII labels

/** Shields-style badge. Pure string: no user input except a number and a letter, both escaped anyway. */
export function badgeSvg(score: number | null, grade: string | null): string {
  const label = "accessibility"
  const value = score === null ? "unavailable" : `${score} ${grade ?? ""}`.trim()
  const full = score === null ? "Accessibility score unavailable" : `Accessibility score: ${score} out of 100, grade ${grade}`
  const lw = width(label)
  const vw = width(value)
  const color = score === null ? GREY : (GRADE_COLOR[grade ?? ""] ?? GREY)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="22" viewBox="0 0 ${lw + vw} 22" role="img" aria-label="${esc(`${label}: ${value}`)}">
<title>${esc(full)}</title>
<clipPath id="r"><rect width="${lw + vw}" height="22" rx="4"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="22" fill="#3f3a34"/><rect x="${lw}" width="${vw}" height="22" fill="${color}"/></g>
<g fill="#fff" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="15">${esc(label)}</text><text x="${lw + vw / 2}" y="15" font-weight="bold">${esc(value)}</text></g></svg>`
}
