import type { CSSProperties } from "react"
import { SEVERITIES, SEVERITY } from "@/lib/severity"
import type { Scan } from "@/lib/scans"
import { cn } from "@/lib/utils"

const COUNT_KEY = { critical: "criticalCount", serious: "seriousCount", moderate: "moderateCount", minor: "minorCount" } as const

/** Mini stacked bar of a scan's affected elements by severity: segments are separated by a 2px surface gap, patterned as well as coloured. */
export function SeverityMeter({ scan }: { scan: Pick<Scan, "criticalCount" | "seriousCount" | "moderateCount" | "minorCount"> }) {
  const parts = SEVERITIES.map((s) => ({ s, n: scan[COUNT_KEY[s]] })).filter((p) => p.n > 0)
  const total = parts.reduce((n, p) => n + p.n, 0)
  const summary = parts.map((p) => `${p.n} ${SEVERITY[p.s].label.toLowerCase()}`).join(", ")

  if (total === 0) return <span className="text-sm text-muted-foreground">No issues</span>
  return (
    <div className="min-w-0">
      <div className="flex h-3 w-full min-w-28 gap-0.5 overflow-hidden rounded-[4px]" role="img" aria-label={`Affected elements: ${summary}`}>
        {parts.map(({ s, n }) => {
          const m = SEVERITY[s]
          return (
            <span key={s} className={cn("relative block h-full first:rounded-l-[4px] last:rounded-r-[4px]", m.bar)} style={{ flexGrow: n, flexBasis: 6 }}>
              <span className={cn("absolute inset-0 opacity-60", m.pattern)} style={{ "--c": "rgb(255 255 255 / .6)" } as CSSProperties} />
            </span>
          )
        })}
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{parts.map((p) => `${p.n} ${SEVERITY[p.s].label.toLowerCase()}`).join(" · ")}</p>
    </div>
  )
}
