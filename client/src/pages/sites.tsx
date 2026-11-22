import { Globe, ScanSearch } from "lucide-react"
import { Link } from "react-router-dom"
import { Delta } from "@/components/insights/delta"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSites } from "@/lib/insights"
import { gradeFor } from "@/lib/scans"

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

export default function SitesPage() {
  const q = useSites()
  return (
    <section className="container-page py-10 sm:py-14">
      <h1 className="font-display text-5xl font-semibold">My sites</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted-foreground">Your scans grouped by website, so you can see whether accessibility is getting better over time.</p>

      {q.isPending && <div role="status" className="mt-8 grid gap-4 sm:grid-cols-2"><span className="sr-only">Loading sites…</span><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-40 rounded-3xl" /></div>}
      {q.isError && <p role="alert" className="mt-8 rounded-2xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">Couldn't load your sites. Please refresh.</p>}
      {q.data?.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
          <ScanSearch className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-3xl font-semibold">No finished scans yet</h2>
          <Link to="/dashboard" className={`${buttonVariants()} mt-5`}>Scan a website</Link>
        </div>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s) => (
            <li key={s.host} className="flex flex-col gap-3 rounded-3xl border border-border bg-card/90 p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background" aria-hidden="true">{s.favicon ? <img src={s.favicon} alt="" className="size-6 object-contain" /> : <Globe className="size-5 text-muted-foreground" />}</span>
                <h2 className="min-w-0 break-all font-sans text-lg font-semibold">{s.host}</h2>
              </div>
              <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-semibold tabular-nums">{s.latest.score}</span><span className="text-lg font-semibold">Grade {gradeFor(s.latest.score)}</span></p>
              <p className="flex flex-wrap items-center gap-2"><Delta delta={s.previousScore === null ? null : s.latest.score - s.previousScore} /><span className="text-sm text-muted-foreground">{s.scanCount} {s.scanCount === 1 ? "scan" : "scans"} · latest <time dateTime={s.latest.createdAt}>{dateFmt.format(new Date(s.latest.createdAt))}</time></span></p>
              <Link to={`/sites/${s.host}`} className={`${buttonVariants({ variant: "outline" })} mt-auto self-start`}>View trend<span className="sr-only"> for {s.host}</span></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
