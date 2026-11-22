import { useId, useState, type CSSProperties, type ReactNode } from "react"
import { motion } from "framer-motion"
import { Table2, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMotionScale } from "@/lib/motion"
import type { Report } from "@/lib/report"
import { SEVERITY } from "@/lib/severity"
import { cn } from "@/lib/utils"

interface Row {
  id: string
  label: string
  icon?: ReactNode
  rules: number
  elements: number
  /** utility classes for the bar fill, and an optional pattern class (second channel) */
  fill: string
  pattern?: string
  patternColor?: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * "Meter list": a name, an aligned bar and a figure per row. Bars are thin (20px), grow from one baseline and round only
 * their data end. Figures are real text next to each bar, so the bars themselves are decoration; a table view carries the
 * same numbers for anyone who prefers them.
 */
function BarChart({ title, group, description, rows, unitHint }: { title: string; group: string; description: string; rows: Row[]; unitHint: string }) {
  const [table, setTable] = useState(false)
  const { speed } = useMotionScale()
  const tableId = useId()
  const max = Math.max(1, ...rows.map((r) => r.elements))

  return (
    <figure className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption>
          <h3 className="font-display text-2xl font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </figcaption>
        <Button variant="outline" size="sm" aria-expanded={table} aria-controls={tableId} onClick={() => setTable((t) => !t)}>
          {table ? <BarChart3 aria-hidden="true" /> : <Table2 aria-hidden="true" />}
          {table ? "View as chart" : "View as table"}
        </Button>
      </div>

      <div id={tableId} className="mt-5">
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <caption className="sr-only">{title}: {unitHint}</caption>
              <thead>
                <tr className="border-b border-border text-sm text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">{group}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Rules</th>
                  <th scope="col" className="py-2 text-right font-semibold">Elements</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2 pr-4 font-medium">{r.label}</th>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.rules}</td>
                    <td className="py-2 text-right tabular-nums">{r.elements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((r, i) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
                <span className="flex items-center gap-2 text-base font-medium">{r.icon}{r.label}</span>
                <Tooltip>
                  <TooltipTrigger render={<div className="relative h-5 w-full cursor-default overflow-hidden rounded-[4px] bg-muted" />}>
                    {r.elements > 0 && (
                      <motion.span
                        aria-hidden="true"
                        className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", r.fill)}
                        initial={{ width: 0 }} animate={{ width: `max(${(r.elements / max) * 100}%, 6px)` }}
                        transition={{ duration: 0.8 * speed, delay: i * 0.07 * speed, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {r.pattern && <span className={cn("absolute inset-0 opacity-60", r.pattern)} style={{ "--c": r.patternColor ?? "rgb(255 255 255 / .6)" } as CSSProperties} />}
                      </motion.span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{r.label}: {plural(r.elements, "element")} across {plural(r.rules, "rule")}</TooltipContent>
                </Tooltip>
                <span className="min-w-20 text-right tabular-nums">
                  <strong className="text-lg font-semibold">{r.elements}</strong>
                  <span className="block text-xs text-muted-foreground">{plural(r.rules, "rule")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  )
}

export default function ReportCharts({ report }: { report: Report }) {
  const severityRows: Row[] = report.severity.map((s) => {
    const m = SEVERITY[s.impact]
    return { id: s.impact, label: m.label, icon: <m.icon className={cn("size-4 shrink-0", m.iconClass)} aria-hidden="true" />, rules: s.rules, elements: s.elements, fill: m.bar, pattern: m.pattern }
  })
  const neutral = "bg-foreground/75"
  const principleRows: Row[] = report.principles.map((p) => ({ id: p.id, label: p.name.replace(" (no WCAG principle)", ""), rules: p.rules, elements: p.elements, fill: neutral }))
  const levelRows: Row[] = report.levels.map((l) => ({ id: l.id, label: l.name, rules: l.rules, elements: l.elements, fill: neutral }))

  return (
    <section aria-labelledby="breakdown-heading" className="space-y-4">
      <h2 id="breakdown-heading" className="font-display text-3xl font-semibold">Breakdown</h2>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <BarChart title="Problems by severity" group="Severity" description="Affected elements per severity. Fill pattern and icon repeat the colour." rows={severityRows} unitHint="affected elements and failing rules per severity" />
        <div className="space-y-5">
          <BarChart title="Problems by WCAG principle" group="Principle" description="Which of the four WCAG principles the failing rules belong to." rows={principleRows} unitHint="affected elements and failing rules per principle" />
          <BarChart title="Problems by conformance level" group="Level" description="Level A is the baseline; AA is what most laws ask for." rows={levelRows} unitHint="affected elements and failing rules per level" />
        </div>
      </div>
    </section>
  )
}
