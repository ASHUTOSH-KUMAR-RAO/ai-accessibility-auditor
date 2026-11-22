import { lazy, Suspense } from "react"
import { ImageOff } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop, useObjectUrl } from "@/lib/hooks"
import type { Report } from "@/lib/report"
import { useScreenshotBlob } from "@/lib/scans"
import { useViewer } from "./viewer-store"

// The viewer (and its overlay logic) is only fetched when a report with a screenshot is shown
const ScreenshotViewer = lazy(() => import("./screenshot-viewer"))

function Loaded({ report }: { report: Report }) {
  const shot = useScreenshotBlob(report.scan.id, !!report.screenshot)
  const src = useObjectUrl(shot.data)
  if (!report.screenshot || shot.isError) {
    return (
      <div className="grid h-full min-h-48 place-content-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
        <ImageOff className="mx-auto size-8" aria-hidden="true" />
        <p>No screenshot is available for this scan, so elements can't be shown on the page.</p>
      </div>
    )
  }
  if (!src) return <Skeleton className="h-full min-h-72 w-full rounded-2xl" aria-hidden="true" />
  return (
    <Suspense fallback={<Skeleton className="h-full min-h-72 w-full rounded-2xl" aria-hidden="true" />}>
      <ScreenshotViewer report={report} src={src} />
    </Suspense>
  )
}

/** Desktop: sticky side panel. Mobile: the same viewer in a full-height bottom sheet (focus is managed by the sheet). */
export function ViewerPanel({ report }: { report: Report }) {
  const isDesktop = useIsDesktop()
  const { sheetOpen, setSheetOpen } = useViewer()

  if (isDesktop) {
    return (
      <aside aria-labelledby="viewer-title" className="sticky top-24 flex h-[calc(100dvh-7rem)] flex-col rounded-3xl border border-border bg-card/90 p-4 shadow-soft">
        <h2 id="viewer-title" className="mb-3 font-display text-2xl font-semibold">Page screenshot</h2>
        <div className="min-h-0 flex-1"><Loaded report={report} /></div>
      </aside>
    )
  }
  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="bottom" showCloseButton className="p-4 data-[side=bottom]:h-dvh data-[side=bottom]:max-h-dvh">
        <SheetTitle className="font-display text-2xl">Page screenshot</SheetTitle>
        <SheetDescription className="sr-only">Highlighted boxes mark the elements with accessibility problems. Closing this view returns you to the issue list.</SheetDescription>
        <div className="min-h-0 flex-1">{sheetOpen && <Loaded report={report} />}</div>
      </SheetContent>
    </Sheet>
  )
}
