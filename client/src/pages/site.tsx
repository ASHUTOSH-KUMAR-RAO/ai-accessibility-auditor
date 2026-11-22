import { lazy, Suspense, useMemo, useState } from "react"
import { ArrowLeft, GitCompareArrows, Globe, SearchX, Table2 } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Delta } from "@/components/insights/delta"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSite } from "@/lib/insights"
import { gradeFor } from "@/lib/scans"
import { cn } from "@/lib/utils"

// The chart is only fetched when a site page opens
const TrendChart = lazy(() => import("@/components/insights/trend-chart"))
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

export default function SitePage() {
  const { host = "" } = useParams()
  const q = useSite(host)
  const [viewport, setViewport] = useState<"ALL" | "DESKTOP" | "MOBILE">("ALL")
  const [table, setTable] = useState(false)
  const scans = useMemo(() => (q.data?.scans ?? []).filter((s) => viewport === "ALL" || s.viewport === viewport), [q.data, viewport])

  return (
    <section className="container-page py-10 sm:py-14">
      <Link to="/sites" className="mb-6 inline-flex items-center gap-2 rounded-lg py-1 font-medium text-link underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />All sites</Link>

      {q.isPending && <div role="status"><span className="sr-only">Loading…</span><Skeleton className="h-12 w-1/2 rounded-xl" /><Skeleton className="mt-6 h-72 w-full rounded-3xl" /></div>}
      {q.isError && (
        <div role="alert" className="mx-auto max-w-lg py-16 text-center">
          <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 font-display text-4xl font-semibold">Site not found</h1>
          <p className="mt-2 text-muted-foreground">There are no finished scans of {host} on your account.</p>
          <Link to="/sites" className={`${buttonVariants()} mt-6`}>Back to my sites</Link>
        </div>
      )}

      {q.data && (
        <div className="space-y-8">
          <header className="flex flex-wrap items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-hidden="true">{q.data.favicon ? <img src={q.data.favicon} alt="" className="size-8 object-contain" /> : <Globe className="size-7 text-muted-foreground" />}</span>
            <div className="min-w-0 flex-1">
              <h1 className="break-all font-display text-4xl font-semibold sm:text-5xl">{host}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>Latest score <strong className="text-foreground">{q.data.latest.score}</strong> (grade {gradeFor(q.data.latest.score)})</span>
                <Delta delta={q.data.scans.length > 1 ? q.data.latest.score - q.data.scans[q.data.scans.length - 2]!.score : null} />
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={`/scans/${q.data.latest.id}`} className={buttonVariants({ variant: "outline" })}>Open latest report</Link>
              {q.data.previous && <Link to={`/compare?a=${q.data.previous.id}&b=${q.data.latest.id}`} className={buttonVariants()}><GitCompareArrows aria-hidden="true" />Compare with previous</Link>}
            </div>
          </header>

          <section aria-labelledby="trend" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 id="trend" className="flex-1 font-display text-2xl font-semibold">Accessibility score over time</h2>
              <div role="group" aria-label="Screen size" className="inline-flex rounded-xl border-2 border-input p-0.5">
                {(["ALL", "DESKTOP", "MOBILE"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={viewport === v} onClick={() => setViewport(v)} className={cn("min-h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold", viewport === v ? "bg-foreground text-background" : "hover:bg-accent")}>
                    {v === "ALL" ? "All" : v === "DESKTOP" ? "Desktop" : "Mobile"}
                  </button>
                ))}
              </div>
            </div>
            {scans.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No scans at this screen size.</p>
            ) : (
              <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" aria-hidden="true" />}><TrendChart scans={scans} /></Suspense>
            )}
            <Button variant="outline" size="sm" className="mt-4" aria-expanded={table} aria-controls="trend-table" onClick={() => setTable((v) => !v)}><Table2 aria-hidden="true" />{table ? "Hide" : "Show"} data table</Button>
            {/* relative: the screen-reader-only spans inside are absolutely positioned and must not widen the page */}
            <div id="trend-table" hidden={!table} tabIndex={table ? 0 : undefined} role="region" aria-label={`Score data for ${host}, scrolls sideways on small screens`} className="relative mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <caption className="sr-only">Accessibility score of every scan of {host}, oldest first</caption>
                <thead><tr className="border-b-2 border-border"><th scope="col" className="py-2 pr-4">Scanned</th><th scope="col" className="py-2 pr-4">Screen</th><th scope="col" className="py-2 pr-4">Score</th><th scope="col" className="py-2 pr-4">Grade</th><th scope="col" className="py-2 pr-4">Critical</th><th scope="col" className="py-2">Report</th></tr></thead>
                <tbody>
                  {scans.map((s, i) => (
                    <tr key={s.id} className="border-b border-border">
                      <th scope="row" className="py-2 pr-4 font-normal"><time dateTime={s.createdAt}>{dateFmt.format(new Date(s.createdAt))}</time></th>
                      <td className="py-2 pr-4">{s.viewport === "MOBILE" ? "Mobile" : "Desktop"}</td>
                      <td className="py-2 pr-4 font-semibold tabular-nums">{s.score}</td>
                      <td className="py-2 pr-4">{gradeFor(s.score)}</td>
                      <td className="py-2 pr-4 tabular-nums">{s.criticalCount}</td>
                      <td className="py-2"><Link to={`/scans/${s.id}`} className="font-medium text-link underline underline-offset-4">Open<span className="sr-only"> scan from {dateFmt.format(new Date(s.createdAt))}</span></Link>
                        {i > 0 && <> · <Link to={`/compare?a=${scans[i - 1]!.id}&b=${s.id}`} className="font-medium text-link underline underline-offset-4">Compare with previous<span className="sr-only"> scan from {dateFmt.format(new Date(s.createdAt))}</span></Link></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
