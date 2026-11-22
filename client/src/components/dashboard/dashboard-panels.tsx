import { Globe, Loader2, Sparkles } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { Delta } from "@/components/insights/delta"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import type { DashboardData } from "@/lib/insights"
import { gradeFor, useCreateScan } from "@/lib/scans"

/** Tiny line of recent scores. Decorative: the numbers are in the text beside it. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span aria-hidden="true" className="h-9 w-24 rounded bg-muted" />
  const w = 96
  const h = 36
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 8) + 4},${h - 4 - (v / 100) * (h - 8)}`)
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} className="h-9 w-24 shrink-0">
      <polyline fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.join(" ")} />
      <circle cx={pts[pts.length - 1]!.split(",")[0]} cy={pts[pts.length - 1]!.split(",")[1]} r="3.5" fill="var(--card)" stroke="var(--foreground)" strokeWidth="2" />
    </svg>
  )
}

export function SitesPanel({ sites }: { sites: DashboardData["sites"] }) {
  if (sites.length === 0) return null
  return (
    <section aria-labelledby="sites-h" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 id="sites-h" className="font-display text-2xl font-semibold">Your sites</h2><Link to="/sites" className="font-medium text-link underline underline-offset-4">All sites</Link></div>
      <ul className="mt-4 divide-y divide-border">
        {sites.map((s) => (
          <li key={s.host}>
            <Link to={`/sites/${s.host}`} className="flex items-center gap-4 rounded-xl py-3 transition-colors hover:bg-accent/60 sm:px-2">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background" aria-hidden="true">{s.favicon ? <img src={s.favicon} alt="" className="size-5 object-contain" /> : <Globe className="size-5 text-muted-foreground" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.host}</span><span className="text-sm text-muted-foreground">{s.scanCount} {s.scanCount === 1 ? "scan" : "scans"} · grade {gradeFor(s.latest.score)}</span></span>
              <Sparkline values={s.trend} />
              <span className="flex w-20 shrink-0 flex-col items-end gap-0.5"><span className="font-display text-3xl font-semibold leading-none tabular-nums">{s.latest.score}</span><Delta delta={s.previousScore === null ? null : s.latest.score - s.previousScore} compact /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TopIssues({ issues }: { issues: DashboardData["topIssues"] }) {
  if (issues.length === 0) return null
  const max = Math.max(...issues.map((i) => i.scans))
  return (
    <section aria-labelledby="top-h" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-6">
      <h2 id="top-h" className="font-display text-2xl font-semibold">Most common issues</h2>
      <p className="mt-1 text-sm text-muted-foreground">Across all your scans, by how many scans they appear in.</p>
      <ol className="mt-4 space-y-4">
        {issues.map((i) => (
          <li key={i.ruleId}>
            <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={i.impact} /><span className="font-semibold">{i.help}</span></div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(8, (i.scans / max) * 100)}%` }} /></div>
              <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">{i.scans} {i.scans === 1 ? "scan" : "scans"}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const SAMPLE_SITE = "https://www.w3.org/WAI/demos/bad/before/home.html"

/** First-run state: one click scans a page that is broken on purpose. */
export function EmptyDashboard() {
  const create = useCreateScan()
  const navigate = useNavigate()
  return (
    <section aria-labelledby="empty-h" className="rounded-3xl border-2 border-dashed border-border bg-card/70 p-8 text-center sm:p-12">
      <Sparkles className="mx-auto size-10" aria-hidden="true" />
      <h2 id="empty-h" className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Your first scan is one click away</h2>
      <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">Type your own address above, or try a page that is inaccessible on purpose and see what AccessLens finds.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          size="lg" disabled={create.isPending}
          onClick={() => create.mutate({ url: SAMPLE_SITE, viewport: "DESKTOP" }, { onSuccess: (s) => navigate(`/scans/${s.id}`), onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't start the scan.") })}
        >
          {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Scan a sample site
        </Button>
        <Link to="/sample" className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 font-semibold hover:bg-accent">Or open the sample report</Link>
      </div>
    </section>
  )
}
