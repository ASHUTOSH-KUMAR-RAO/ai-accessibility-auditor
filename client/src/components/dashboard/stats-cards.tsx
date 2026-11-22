import { RotateCw } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useScanStats } from "@/lib/report"
import { gradeFor } from "@/lib/scans"

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft">
      <h3 className="text-base font-semibold text-muted-foreground">{label}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Three headline numbers from /scans/stats. */
export function StatsCards() {
  const { data, isPending, isError, refetch, isFetching } = useScanStats()

  if (isPending) {
    return <div role="status" className="grid gap-4 sm:grid-cols-3"><span className="sr-only">Loading your stats…</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-border bg-card/80 p-4">
        <p className="font-medium">We couldn't load your stats.</p>
        <Button variant="outline" size="sm" className="mt-2" disabled={isFetching} onClick={() => void refetch()}><RotateCw aria-hidden="true" />Try again</Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="stats-heading" className="grid gap-4 sm:grid-cols-3">
      <h2 id="stats-heading" className="sr-only">Your scan summary</h2>
      <Card label="Scans">
        <p className="font-display text-5xl font-semibold leading-none tabular-nums">{data.totalScans}</p>
        <p className="mt-2 text-sm text-muted-foreground">{data.completedScans} completed · <Link to="/scans" className="font-medium text-link underline underline-offset-4">View all</Link></p>
      </Card>
      <Card label="Average score">
        {data.averageScore === null ? (
          <p className="text-lg text-muted-foreground">Finish a scan to see your average.</p>
        ) : (
          <>
            <p className="font-display text-5xl font-semibold leading-none tabular-nums">{data.averageScore}<span className="ml-1 text-lg font-normal text-muted-foreground">/100</span></p>
            <p className="mt-2 text-sm text-muted-foreground">Grade {gradeFor(data.averageScore)}</p>
          </>
        )}
      </Card>
      <Card label="Most common issue">
        {data.mostCommonIssue ? (
          <>
            <p className="font-display text-2xl font-semibold leading-snug">{data.mostCommonIssue.help}</p>
            <p className="mt-2 text-sm text-muted-foreground">Found in {data.mostCommonIssue.scans} {data.mostCommonIssue.scans === 1 ? "scan" : "scans"}</p>
          </>
        ) : (
          <p className="text-lg text-muted-foreground">No issues found yet.</p>
        )}
      </Card>
    </section>
  )
}
