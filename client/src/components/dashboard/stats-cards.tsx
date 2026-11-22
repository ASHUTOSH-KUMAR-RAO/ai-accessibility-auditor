import { useEffect, useState } from "react"
import { animate } from "framer-motion"
import { Globe, RotateCw, ScanSearch, ShieldCheck, Gauge, type LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardData } from "@/lib/insights"
import { useMotionScale } from "@/lib/motion"
import { gradeFor } from "@/lib/scans"

function Count({ to }: { to: number }) {
  const { speed } = useMotionScale()
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, to, { duration: 1.1 * speed, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [to, speed])
  return <><span aria-hidden="true">{v}</span><span className="sr-only">{to}</span></>
}

function Card({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-base font-semibold text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Four headline numbers. */
export function StatsCards({ data, isPending, isError, refetch }: { data?: DashboardData; isPending: boolean; isError: boolean; refetch: () => void }) {
  if (isPending) return <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><span className="sr-only">Loading your stats…</span>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-border bg-card/80 p-4">
        <p className="font-medium">We couldn&apos;t load your stats.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={refetch}><RotateCw aria-hidden="true" />Try again</Button>
      </div>
    )
  }
  const t = data.totals
  const big = "font-display text-5xl font-semibold leading-none tabular-nums"
  return (
    <section aria-labelledby="stats-heading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <h2 id="stats-heading" className="sr-only">Your scan summary</h2>
      <Card icon={ScanSearch} label="Total scans"><p className={big}><Count to={t.scans} /></p><p className="mt-2 text-sm text-muted-foreground">{t.completed} completed · <Link to="/scans" className="font-medium text-link underline underline-offset-4">View all</Link></p></Card>
      <Card icon={Gauge} label="Average score">
        {t.averageScore === null ? <p className="text-lg text-muted-foreground">Finish a scan to see it.</p> : <><p className={big}><Count to={t.averageScore} /><span className="ml-1 text-lg font-normal text-muted-foreground">/100</span></p><p className="mt-2 text-sm text-muted-foreground">Grade {gradeFor(t.averageScore)}</p></>}
      </Card>
      <Card icon={Globe} label="Sites tracked"><p className={big}><Count to={t.sites} /></p><p className="mt-2 text-sm text-muted-foreground"><Link to="/sites" className="font-medium text-link underline underline-offset-4">See score trends</Link></p></Card>
      <Card icon={ShieldCheck} label="AI fixes verified"><p className={big}><Count to={t.aiFixesVerified} /></p><p className="mt-2 text-sm text-muted-foreground">Re-checked with axe-core</p></Card>
    </section>
  )
}
