import { useMemo, useState } from "react"
import type { SiteScan } from "@/lib/insights"
import { gradeFor } from "@/lib/scans"

const W = 720
const H = 300
const M = { top: 20, right: 48, bottom: 40, left: 44 }
const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })
const fmtLong = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

/**
 * Score over time. One series: no legend (the heading names it), a thin 2px line in ink, 10px markers with a surface ring,
 * recessive grid, the latest value labelled directly. Every point is keyboard focusable and shows a tooltip.
 */
export default function TrendChart({ scans }: { scans: SiteScan[] }) {
  const [active, setActive] = useState<number | null>(null)
  const pts = useMemo(() => {
    const times = scans.map((s) => +new Date(s.createdAt))
    const t0 = Math.min(...times)
    const span = Math.max(1, Math.max(...times) - t0)
    const single = scans.length === 1
    return scans.map((s, i) => ({
      s,
      x: M.left + (single ? 0.5 : (times[i]! - t0) / span) * (W - M.left - M.right),
      y: M.top + (1 - s.score / 100) * (H - M.top - M.bottom),
    }))
  }, [scans])

  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const shown = active !== null ? pts[active] : null
  const last = pts[pts.length - 1]!
  const ticks = pts.length <= 6 ? pts : [pts[0]!, pts[Math.floor(pts.length / 2)]!, last]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Score over time, ${scans.length} ${scans.length === 1 ? "scan" : "scans"}. The table below lists the same data.`} className="h-auto w-full">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = M.top + (1 - v / 100) * (H - M.top - M.bottom)
          return (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={M.left - 8} y={y} textAnchor="end" dominantBaseline="central" fontSize={13} fill="var(--muted-foreground)">{v}</text>
            </g>
          )
        })}
        {ticks.map((p) => <text key={p.s.id} x={p.x} y={H - 14} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)">{fmt.format(new Date(p.s.createdAt))}</text>)}
        {pts.length > 1 && <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {shown && <line x1={shown.x} x2={shown.x} y1={M.top} y2={H - M.bottom} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="3 4" />}
        {pts.map((p, i) => (
          <g key={p.s.id}>
            <circle cx={p.x} cy={p.y} r={5.5} fill="var(--card)" stroke="var(--foreground)" strokeWidth={2.5} />
            {/* a larger invisible target: easier to hit than the marker itself */}
            <circle
              cx={p.x} cy={p.y} r={16} fill="transparent" tabIndex={0} role="img" className="cursor-pointer"
              aria-label={`${fmtLong.format(new Date(p.s.createdAt))}: score ${p.s.score}, grade ${gradeFor(p.s.score)}, ${p.s.viewport === "MOBILE" ? "mobile" : "desktop"}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
            />
          </g>
        ))}
        <text x={Math.min(last.x + 10, W - 4)} y={last.y} dominantBaseline="central" fontSize={16} fontWeight={700} fill="var(--foreground)" textAnchor={last.x + 40 > W ? "end" : "start"} dy={last.x + 40 > W ? -16 : 0}>{last.s.score}</text>
      </svg>
      {shown && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lift"
          style={{ left: `${(shown.x / W) * 100}%`, top: `${(shown.y / H) * 100}%`, transform: `translate(${shown.x > W * 0.7 ? "-105%" : "5%"}, -120%)` }}
        >
          <p className="font-semibold">Score {shown.s.score} · Grade {gradeFor(shown.s.score)}</p>
          <p className="text-muted-foreground">{fmtLong.format(new Date(shown.s.createdAt))}</p>
        </div>
      )}
    </div>
  )
}
