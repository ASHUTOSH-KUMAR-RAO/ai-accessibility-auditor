import { useState } from "react"
import { GitCompareArrows, History, Share2, CalendarClock, ExternalLink, Globe, Loader2, Monitor, RotateCw, Smartphone, Timer, Trash2 } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { useRescan, type Report } from "@/lib/report"
import { formatDuration } from "@/lib/time"
import { hostOf } from "@/lib/url"
import { DeleteScanDialog } from "./delete-scan-dialog"
import { ExportButtons } from "./export-buttons"
import { ShareDialog } from "./share-dialog"
import { useSite } from "@/lib/insights"

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

export function ReportHeader({ report }: { report: Report }) {
  const { scan } = report
  const navigate = useNavigate()
  const rescan = useRescan()
  const [confirm, setConfirm] = useState(false)
  const [sharing, setSharing] = useState(false)
  const url = scan.finalUrl ?? scan.url
  const title = scan.pageTitle || hostOf(url)
  const Device = scan.viewport === "MOBILE" ? Smartphone : Monitor
  const when = scan.completedAt ?? scan.createdAt
  const host = (() => { try { return new URL(url).hostname } catch { return "" } })()
  const site = useSite(host)
  const previous = (() => {
    const list = site.data?.scans ?? []
    const i = list.findIndex((s) => s.id === scan.id)
    return i > 0 ? list[i - 1] : null
  })()

  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-4">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-hidden="true">
          {scan.favicon ? <img src={scan.favicon} alt="" className="size-8 object-contain" /> : <Globe className="size-7 text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          <h1 className="break-words font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex max-w-full items-center gap-1.5 break-all text-link underline underline-offset-4">
            {url}<ExternalLink className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
          </a>
          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
            <li className="inline-flex items-center gap-1.5"><Device className="size-4" aria-hidden="true" />{scan.viewport === "MOBILE" ? "Mobile · 390 × 844" : "Desktop · 1280 × 800"}</li>
            <li className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" /><span className="sr-only">Scanned </span><time dateTime={when}>{dateFmt.format(new Date(when))}</time></li>
            {scan.durationMs !== null && <li className="inline-flex items-center gap-1.5"><Timer className="size-4" aria-hidden="true" /><span className="sr-only">Took </span>{formatDuration(scan.durationMs)}</li>}
          </ul>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        <Button
          disabled={rescan.isPending}
          onClick={() => rescan.mutate(scan.id, { onSuccess: (s) => navigate(`/scans/${s.id}`), onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't start the scan.") })}
        >
          {rescan.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}Re-scan
        </Button>
        <Button variant="outline" onClick={() => setSharing(true)}><Share2 aria-hidden="true" />Share</Button>
        <ExportButtons scanId={scan.id} kinds={["pdf"]} size="default" />
        <Button variant="outline" onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" />Delete</Button>
        {(previous || (site.data?.scans.length ?? 0) > 0) && (
          <div className="flex basis-full flex-wrap gap-3">
            {previous && <Link to={`/compare?a=${previous.id}&b=${scan.id}`} className={buttonVariants({ variant: "outline" })}><GitCompareArrows aria-hidden="true" />Compare with previous scan</Link>}
            {host && (site.data?.scans.length ?? 0) > 1 && <Link to={`/sites/${host}`} className={buttonVariants({ variant: "outline" })}><History aria-hidden="true" />Score trend for {host}</Link>}
          </div>
        )}
      </div>
      <ShareDialog scanId={scan.id} open={sharing} onOpenChange={setSharing} />

      <DeleteScanDialog scanId={scan.id} label={title} open={confirm} onOpenChange={setConfirm} onDeleted={() => navigate("/scans")} />
    </header>
  )
}
