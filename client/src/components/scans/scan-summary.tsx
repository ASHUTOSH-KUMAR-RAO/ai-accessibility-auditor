import { useEffect, useState } from "react"
import { ExternalLink, ImageOff, RotateCw, ScanSearch } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BrailleText } from "@/components/brand/braille-text"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { ScoreRing } from "@/components/scans/score-ring"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { scoreLabel, useCreateScan, useScreenshotBlob, type Scan } from "@/lib/scans"
import { formatDuration } from "@/lib/time"
import { hostOf } from "@/lib/url"

/** Blob → object URL with cleanup (the screenshot endpoint needs the auth header, so <img src> can't hit it directly). */
function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource (object URL)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function Screenshot({ scan }: { scan: Scan }) {
  const shot = useScreenshotBlob(scan.id, scan.hasScreenshot)
  const src = useObjectUrl(shot.data)
  const title = scan.pageTitle || hostOf(scan.finalUrl ?? scan.url)

  if (!scan.hasScreenshot || shot.isError) {
    return (
      <div className="grid h-full min-h-48 place-content-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
        <ImageOff className="mx-auto size-8" aria-hidden="true" />
        <p>No screenshot available for this scan.</p>
      </div>
    )
  }
  if (!src) return <Skeleton className="h-64 w-full rounded-2xl" aria-hidden="true" />
  return (
    <div className="max-h-80 overflow-hidden rounded-2xl border border-border bg-muted shadow-soft">
      <img src={src} alt={`Screenshot of ${title} at the top of the page`} className="w-full object-cover object-top" />
    </div>
  )
}

export function ScanSummary({ scan }: { scan: Scan }) {
  const navigate = useNavigate()
  const rescan = useCreateScan()
  const score = scan.score ?? 0
  const finalUrl = scan.finalUrl ?? scan.url

  return (
    <section aria-labelledby="summary-title" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="eyebrow">Scan complete</p>
          <h2 id="summary-title" className="mt-2 break-words font-display text-3xl font-semibold sm:text-4xl">{scan.pageTitle || hostOf(finalUrl)}</h2>
          <a href={finalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all text-link underline underline-offset-4">
            {finalUrl}<ExternalLink className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
          </a>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <ScoreRing score={score} />
            <div>
              <p className="font-display text-3xl font-semibold">{scoreLabel(score)}</p>
              <p className="mt-1 text-muted-foreground">
                {scan.viewport === "MOBILE" ? "Mobile" : "Desktop"} view
                {scan.durationMs ? ` · scanned in ${formatDuration(scan.durationMs)}` : ""}
              </p>
            </div>
          </div>

          <h3 className="mt-8 text-xl font-semibold">Affected elements</h3>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            <li><SeverityBadge severity="critical" count={scan.criticalCount} /></li>
            <li><SeverityBadge severity="serious" count={scan.seriousCount} /></li>
            <li><SeverityBadge severity="moderate" count={scan.moderateCount} /></li>
            <li><SeverityBadge severity="minor" count={scan.minorCount} /></li>
          </ul>
          <p className="mt-4 text-muted-foreground">
            <span className="font-semibold text-foreground">{scan.passesCount}</span> checks passed ·{" "}
            <span className="font-semibold text-foreground">{scan.incompleteCount}</span> need a manual look
          </p>
        </div>

        <Screenshot scan={scan} />
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-muted/60 p-4 sm:flex-row sm:items-center">
        <BrailleText text="soon" className="shrink-0" />
        <p className="text-muted-foreground"><span className="font-semibold text-foreground">Full report coming in Phase 4.</span> Every issue, where it is on the page, and how to fix it.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}><ScanSearch aria-hidden="true" />Scan another website</Link>
        <Button
          variant="ghost"
          disabled={rescan.isPending}
          onClick={() => rescan.mutate({ url: scan.url, viewport: scan.viewport }, { onSuccess: (s) => navigate(`/scans/${s.id}`), onError: (e) => toast.error(e.message) })}
        >
          <RotateCw aria-hidden="true" />Scan again
        </Button>
      </div>
    </section>
  )
}
