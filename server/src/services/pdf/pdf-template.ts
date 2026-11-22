import type { FixResult } from "../ai/fix.service.js"
import type { SummaryOutput } from "../ai/schemas.js"
import type { Report } from "../report/types.js"
import type { TabOrder } from "../scanner/tab-order.js"

// Builds the whole PDF as one self-contained HTML document: real text, headings, lists and tables (so Chromium can tag them),
// the screenshot inlined as a data: URI, no scripts, no external resources. Everything from the scanned page is escaped.

export const PDF_VERSION = 1

export interface TopIssue {
  rule: Report["rules"][number]
  selector: string
  html: string
  fix: Pick<FixResult, "source" | "content" | "verification"> | null
}

export interface PdfData {
  report: Report
  summary: SummaryOutput
  summarySource: "ai" | "guided"
  topIssues: TopIssue[]
  tabOrder: TabOrder | null
  screenshot: { dataUri: string; width: number; height: number } | null
  generatedAt: Date
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`
const SEV_COLOR = { critical: "#a3123a", serious: "#6b3fa0", moderate: "#0b6bb5", minor: "#2f6a60" } as const
const SEV_PATTERN = { critical: "▲▲", serious: "◆", moderate: "●", minor: "○" } as const
const VERIFY: Record<string, string> = { VERIFIED: "Verified fix (axe re-check passed)", NOT_VERIFIED: "Not verified (axe still reports it)", NOT_APPLICABLE: "Needs page context to verify" }
const WARNING_LABEL: Record<string, string> = {
  "focus-jump": "Focus jump", "invisible-focus": "Invisible focus", "focus-lost": "Focus dropped", offscreen: "Off-screen focus", trap: "Keyboard trap", unreachable: "Unreachable control",
}

const CSS = `
@page { size: A4; margin: 18mm 16mm 20mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", system-ui, -apple-system, Arial, Helvetica, sans-serif; color: #1d1a16; font-size: 10pt; line-height: 1.5; }
body { margin: 0; }
h1, h2, h3, h4 { font-family: Georgia, "Times New Roman", serif; line-height: 1.15; margin: 0 0 .4em; }
h2 { font-size: 20pt; border-bottom: 3px solid #f58a0b; padding-bottom: 4pt; margin-top: 0; }
h3 { font-size: 13pt; margin-top: 14pt; }
p { margin: 0 0 .6em; }
section { break-before: page; }
.cover { break-before: auto; height: 297mm; padding: 26mm 22mm; background: #1d1a16; color: #f3ecdd; position: relative; overflow: hidden; }
.cover .dots { position: absolute; inset: 0; opacity: .1; background-image: radial-gradient(#f3ecdd 1.6px, transparent 1.8px); background-size: 14px 14px; }
.cover > * { position: relative; }
.brand { display: flex; align-items: center; gap: 10pt; font-family: Georgia, serif; font-size: 18pt; }
.mark { width: 26pt; height: 26pt; }
.cover h1 { font-size: 34pt; margin-top: 48mm; color: #f3ecdd; }
.cover .site { font-size: 14pt; color: #ffc567; word-break: break-all; }
.cover .meta { margin-top: 8mm; color: #cfc6b3; font-size: 11pt; }
.score { margin-top: 18mm; display: flex; align-items: baseline; gap: 16pt; }
.score .n { font-family: Georgia, serif; font-size: 80pt; line-height: 1; color: #f3ecdd; }
.score .g { font-family: Georgia, serif; font-size: 40pt; color: #1d1a16; background: #f58a0b; border-radius: 10pt; padding: 0 14pt; }
.verdict { margin-top: 10mm; font-size: 14pt; max-width: 150mm; color: #f3ecdd; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 9pt; }
th, td { text-align: left; vertical-align: top; padding: 4pt 6pt; border-bottom: 1px solid #ddd1bb; }
th { background: #f1e9d8; font-weight: 700; }
.bar { height: 10pt; background: #efe6d4; border-radius: 3pt; overflow: hidden; min-width: 60mm; }
.bar > i { display: block; height: 100%; }
.chip { display: inline-block; border: 1px solid #8a7e6c; border-radius: 10pt; padding: 0 6pt; font-size: 8.5pt; font-weight: 600; margin-right: 4pt; white-space: nowrap; }
.card { border: 1px solid #ddd1bb; border-radius: 6pt; padding: 8pt 10pt; margin: 0 0 8pt; break-inside: avoid; }
.priority { display: flex; gap: 8pt; }
.num { flex: none; width: 18pt; height: 18pt; border: 2px solid #1d1a16; border-radius: 50%; text-align: center; font-weight: 700; line-height: 14pt; }
pre { margin: 4pt 0; padding: 6pt 8pt; background: #f4ecda; border: 1px solid #ddd1bb; border-radius: 4pt; white-space: pre-wrap; word-break: break-all; font: 8pt/1.4 Consolas, "Courier New", monospace; }
.shot { position: relative; display: inline-block; border: 1px solid #8a7e6c; }
.shot img { display: block; height: 215mm; width: auto; max-width: 100%; }
.box { position: absolute; border: 2px solid; }
.box b { position: absolute; top: -9pt; left: -2px; font-size: 7pt; color: #fff; padding: 0 3pt; border-radius: 2pt; }
.small { font-size: 8.5pt; color: #5c5448; }
.warn { margin: 2pt 0; }
ul, ol { margin: 0 0 .6em; padding-left: 16pt; }
`

const MARK = `<svg class="mark" viewBox="0 0 20 30" aria-hidden="true" focusable="false"><g fill="#f58a0b"><circle cx="6" cy="4" r="3.2"/><circle cx="6" cy="15" r="3.2"/><circle cx="14" cy="15" r="3.2"/><circle cx="14" cy="26" r="3.2"/></g><g fill="#f3ecdd" opacity=".35"><circle cx="14" cy="4" r="3.2"/><circle cx="6" cy="26" r="3.2"/></g></svg>`

function severityRows(r: Report) {
  const max = Math.max(1, ...r.severity.map((s) => s.elements))
  return r.severity
    .map(
      (s) => `<tr><th scope="row">${SEV_PATTERN[s.impact]} ${esc(s.impact[0]!.toUpperCase() + s.impact.slice(1))}</th><td>${plural(s.rules, "rule")}</td><td>${plural(s.elements, "element")}</td>
<td><div class="bar" role="img" aria-label="${esc(`${s.elements} of ${max} (relative bar)`)}"><i style="width:${Math.round((s.elements / max) * 100)}%;background:${SEV_COLOR[s.impact]}"></i></div></td></tr>`,
    )
    .join("")
}

function topIssue(t: TopIssue, i: number) {
  const f = t.fix
  const code = f?.content.fixedHtml && f.content.fixedHtml.replace(/\s+/g, " ") !== t.html.replace(/\s+/g, " ") ? f.content.fixedHtml : null
  return `<div class="card"><h4>${i + 1}. ${esc(t.rule.help)}</h4>
<p><span class="chip">${esc(t.rule.impact)}</span><span class="chip">${plural(t.rule.totalNodes, "element")}</span>${t.rule.criteria.map((c) => `<span class="chip">WCAG ${esc(c.id)}</span>`).join("")}</p>
<p class="small">Example element: <code>${esc(t.selector.slice(0, 160))}</code></p>
${f ? `<p>${esc(f.content.explanation)}</p><p class="small"><strong>${f.source === "ai" ? "AI fix" : "Guided fix (no AI)"}</strong> · ${esc(VERIFY[f.verification.status])}</p>
<h5 style="margin:6pt 0 2pt;font-size:9pt">Before</h5><pre>${esc(t.html)}</pre>
${code ? `<h5 style="margin:6pt 0 2pt;font-size:9pt">After</h5><pre>${esc(code)}</pre>` : ""}
${f.content.cssFix ? `<h5 style="margin:6pt 0 2pt;font-size:9pt">CSS</h5><pre>${esc(f.content.cssFix)}</pre>` : ""}
<ol>${f.content.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : `<p>${esc(t.rule.description)}</p>`}</div>`
}

function keyboardSection(o: TabOrder | null) {
  if (!o) return `<p>Keyboard order was not recorded for this scan.</p>`
  const counts = Object.entries(
    o.warnings.reduce<Record<string, number>>((m, w) => ((m[w.type] = (m[w.type] ?? 0) + 1), m), {}),
  )
  return `<p>Pressing Tab moved focus through <strong>${plural(o.stops.length, "stop")}</strong>${o.truncated ? " (recording stopped at the limit)" : ""}${o.complete ? ", and focus left the page at the end as expected" : ""}.</p>
${counts.length === 0 ? `<p>No keyboard problems were detected.</p>` : `<table><thead><tr><th scope="col">Problem</th><th scope="col">Count</th></tr></thead><tbody>${counts.map(([t, n]) => `<tr><td>${esc(WARNING_LABEL[t] ?? t)}</td><td>${n}</td></tr>`).join("")}</tbody></table>
<h3>Details</h3>${o.warnings.slice(0, 15).map((w) => `<p class="warn">• ${esc(w.message)}</p>`).join("")}`}
<h3>Focus order (first ${Math.min(25, o.stops.length)} stops)</h3>
<table><thead><tr><th scope="col">#</th><th scope="col">Role</th><th scope="col">Name</th><th scope="col">Focus visible</th></tr></thead><tbody>
${o.stops.slice(0, 25).map((s) => `<tr><td>${s.n}</td><td>${esc(s.role)}</td><td>${esc(s.name || "(no accessible name)")}</td><td>${s.focusVisible ? "Yes" : "No"}</td></tr>`).join("")}</tbody></table>`
}

export function renderPdfHtml(d: PdfData): string {
  const { report: r, summary: s } = d
  const date = d.generatedAt.toISOString().slice(0, 10)
  const host = (() => { try { return new URL(r.scan.finalUrl ?? r.scan.url).hostname } catch { return r.scan.url } })()
  const shot = d.screenshot
  const markers = shot
    ? r.markers.slice(0, 120).map((m) => `<div class="box" style="left:${(m.box.x / shot.width) * 100}%;top:${(m.box.y / shot.height) * 100}%;width:${Math.max(0.4, (m.box.width / shot.width) * 100)}%;height:${Math.max(0.4, (m.box.height / shot.height) * 100)}%;border-color:${SEV_COLOR[m.impact]}"><b style="background:${SEV_COLOR[m.impact]}">${m.n}</b></div>`).join("")
    : ""
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${esc(`Accessibility report for ${host} (${date})`)}</title><meta name="author" content="AccessLens"><style>${CSS}</style></head><body>
<header class="cover"><div class="dots"></div>
<div class="brand">${MARK}<span>AccessLens</span></div>
<h1>Accessibility report</h1>
<p class="site">${esc(r.scan.finalUrl ?? r.scan.url)}</p>
<p class="meta">${esc(r.scan.pageTitle ?? "")}${r.scan.pageTitle ? " · " : ""}${esc(r.scan.viewport === "MOBILE" ? "Mobile" : "Desktop")} view · Scanned ${esc(new Date(r.scan.completedAt ?? r.scan.createdAt).toISOString().slice(0, 10))} · Report created ${date}</p>
<div class="score"><span class="n" aria-label="Score ${r.scan.score} out of 100">${r.scan.score}</span><span class="g" aria-label="Grade ${esc(r.scan.grade)}">${esc(r.scan.grade)}</span></div>
<p class="verdict">${esc(r.scan.verdict)}</p></header>

<main>
<section><h2>Executive summary</h2>
<p class="small">${d.summarySource === "ai" ? "Written by AI from the scan results." : "Generated from the scan results by built-in rules (no AI)."}</p>
<p style="font-size:12pt">${esc(s.verdict)}</p>
<h3>Top priorities</h3>
${s.priorities.map((p, i) => `<div class="card priority"><span class="num">${i + 1}</span><div><strong>${esc(p.title)}</strong> <span class="chip">${esc(p.effort)} effort</span><p>${esc(p.why)}</p></div></div>`).join("")}
${s.quickWins.length ? `<h3>Quick wins</h3><ul>${s.quickWins.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
<h3>Who is most affected</h3><p>${esc(s.mostAffected)}</p></section>

<section><h2>Breakdown</h2>
<h3>By severity</h3>
<table><thead><tr><th scope="col">Severity</th><th scope="col">Rules</th><th scope="col">Elements</th><th scope="col">Relative size</th></tr></thead><tbody>${severityRows(r)}</tbody></table>
<h3>By WCAG principle</h3>
<table><thead><tr><th scope="col">Principle</th><th scope="col">Rules</th><th scope="col">Elements</th></tr></thead><tbody>${r.principles.map((p) => `<tr><th scope="row">${esc(p.name)}</th><td>${p.rules}</td><td>${p.elements}</td></tr>`).join("")}</tbody></table>
<h3>By conformance level</h3>
<table><thead><tr><th scope="col">Level</th><th scope="col">Rules</th><th scope="col">Elements</th></tr></thead><tbody>${r.levels.map((l) => `<tr><th scope="row">${esc(l.name)}</th><td>${l.rules}</td><td>${l.elements}</td></tr>`).join("")}</tbody></table>
<p class="small">${r.counts.passed} rules passed. ${r.counts.review} items need a manual check.</p></section>

<section><h2>Top issues and fixes</h2>
<p class="small">The most important rules, with an example element and its fix. Fixes marked AI were written by an AI model and re-checked with axe-core where possible; always review code before shipping it.</p>
${d.topIssues.map(topIssue).join("") || "<p>No failing rules.</p>"}</section>

<section><h2>Keyboard navigation</h2>${keyboardSection(d.tabOrder)}</section>

${shot ? `<section><h2>Page screenshot</h2><p class="small">Numbered boxes mark elements with problems. The appendix lists every rule.</p>
<div class="shot"><img src="${esc(shot.dataUri)}" alt="${esc(`Screenshot of ${host} with ${r.markers.length} numbered markers on elements that have accessibility problems.`)}">${markers}</div></section>` : ""}

<section><h2>Appendix: all failing rules</h2>
<table><thead><tr><th scope="col">Rule</th><th scope="col">Severity</th><th scope="col">Elements</th><th scope="col">WCAG</th><th scope="col">What to fix</th></tr></thead><tbody>
${r.rules.map((x) => `<tr><td><code>${esc(x.id)}</code></td><td>${esc(x.impact)}</td><td>${x.totalNodes}</td><td>${esc(x.criteria.map((c) => c.id).join(", ") || "Best practice")}</td><td>${esc(x.help)}</td></tr>`).join("")}</tbody></table>
</section></main></body></html>`
}
