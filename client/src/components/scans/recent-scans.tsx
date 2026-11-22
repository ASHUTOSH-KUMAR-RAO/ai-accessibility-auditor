import { History, Monitor, RotateCw, Smartphone } from "lucide-react"
import { Link } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import { motion } from "framer-motion"
import { StatusChip } from "@/components/scans/status-chip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMotionScale } from "@/lib/motion"
import { useRecentScans, type Scan } from "@/lib/scans"
import { timeAgo, useNow } from "@/lib/time"
import { hostOf } from "@/lib/url"

function Row({ scan, now, index }: { scan: Scan; now: number; index: number }) {
  const { distance, speed } = useMotionScale()
  const Device = scan.viewport === "MOBILE" ? Smartphone : Monitor
  let path = ""
  try {
    const u = new URL(scan.normalizedUrl)
    path = u.pathname === "/" ? "" : u.pathname + u.search
  } catch {
    /* keep empty */
  }
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 * distance }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 * speed, delay: Math.min(index, 6) * 0.05 * speed }}
    >
      <Link
        to={`/scans/${scan.id}`}
        className="grid gap-x-4 gap-y-2 rounded-2xl border border-border bg-card/80 p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {hostOf(scan.normalizedUrl)}<span className="font-normal text-muted-foreground">{path}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Device className="size-4" aria-hidden="true" />{scan.viewport === "MOBILE" ? "Mobile" : "Desktop"}</span>
            <span>{timeAgo(scan.createdAt, now)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          {scan.status === "COMPLETED" && scan.score !== null && (
            <span className="font-display text-2xl font-semibold tabular-nums"><span className="sr-only">Score </span>{scan.score}<span className="text-sm font-normal text-muted-foreground">/100</span></span>
          )}
          <StatusChip scan={scan} />
        </div>
      </Link>
    </motion.li>
  )
}

export function RecentScans() {
  const { data, isPending, isError, refetch, isFetching } = useRecentScans()
  const now = useNow(true, 30_000)

  return (
    <section aria-labelledby="recent-title" className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-title" className="flex items-center gap-2.5 font-display text-3xl font-semibold"><History className="size-6" aria-hidden="true" />Recent scans</h2>
        <Link to="/scans" className={buttonVariants({ variant: "outline", size: "sm" })}>View all scans</Link>
      </div>

      <div className="mt-5">
        {isPending && (
          <div role="status" className="space-y-3">
            <span className="sr-only">Loading your recent scans…</span>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[4.75rem] w-full rounded-2xl" />)}
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-2xl border-2 border-critical/50 bg-critical-soft p-5 text-critical">
            <p className="font-semibold">We couldn't load your recent scans.</p>
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()} className="mt-3 border-critical/50 text-critical"><RotateCw aria-hidden="true" />Try again</Button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-display text-2xl font-semibold">No scans yet</p>
            <p className="mt-1 text-muted-foreground">Scan your first website above and it will show up here, live.</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className="space-y-3">
            {data.items.map((scan, i) => <Row key={scan.id} scan={scan} now={now} index={i} />)}
          </ul>
        )}
      </div>
    </section>
  )
}
