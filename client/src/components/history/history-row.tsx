import { Monitor, RotateCw, Smartphone, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { SeverityMeter } from "@/components/history/severity-meter"
import { StatusChip } from "@/components/scans/status-chip"
import { Button } from "@/components/ui/button"
import { gradeFor } from "@/lib/scans"
import { isActive, type Scan } from "@/lib/scans"
import { timeAgo } from "@/lib/time"
import { hostOf } from "@/lib/url"

export function HistoryRow({ scan, now, onRescan, onDelete, busy }: { scan: Scan; now: number; onRescan: (s: Scan) => void; onDelete: (s: Scan) => void; busy: boolean }) {
  const Device = scan.viewport === "MOBILE" ? Smartphone : Monitor
  const title = scan.pageTitle || hostOf(scan.normalizedUrl)
  let path = ""
  try {
    const u = new URL(scan.normalizedUrl)
    path = u.pathname === "/" ? "" : u.pathname + u.search
  } catch {
    /* keep empty */
  }
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border border-border bg-card/85 p-4 shadow-soft transition-shadow hover:shadow-lift sm:p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <h3 className="truncate font-display text-xl font-semibold leading-snug">
          <Link to={`/scans/${scan.id}`} className="rounded outline-none hover:underline hover:underline-offset-4 focus-visible:underline">
            {title}<span className="sr-only">, {scan.status.toLowerCase()}{scan.score !== null ? `, score ${scan.score}` : ""}</span>
          </Link>
        </h3>
        <p className="truncate text-sm text-muted-foreground">{hostOf(scan.normalizedUrl)}{path}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <StatusChip scan={scan} />
          <span className="inline-flex items-center gap-1.5"><Device className="size-4" aria-hidden="true" />{scan.viewport === "MOBILE" ? "Mobile" : "Desktop"}</span>
          <time dateTime={scan.createdAt}>{timeAgo(scan.createdAt, now)}</time>
        </p>
      </div>

      <div className="flex items-center gap-4">
        {scan.status === "COMPLETED" && scan.score !== null ? (
          <>
            <div className="shrink-0 text-center">
              <p className="font-display text-4xl font-semibold leading-none tabular-nums"><span className="sr-only">Score </span>{scan.score}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Grade {gradeFor(scan.score)}</p>
            </div>
            <div className="min-w-0 flex-1"><SeverityMeter scan={scan} /></div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{scan.status === "FAILED" ? (scan.errorMessage ?? "The scan failed.") : isActive(scan.status) ? "In progress…" : "No score"}</p>
        )}
      </div>

      <div className="flex gap-2 lg:justify-end">
        <Button variant="outline" size="sm" disabled={busy || isActive(scan.status)} onClick={() => onRescan(scan)} aria-label={`Re-scan ${title}`}><RotateCw aria-hidden="true" />Re-scan</Button>
        <Button variant="ghost" size="sm" disabled={isActive(scan.status)} onClick={() => onDelete(scan)} aria-label={`Delete scan of ${title}`}><Trash2 aria-hidden="true" />Delete</Button>
      </div>
    </li>
  )
}
