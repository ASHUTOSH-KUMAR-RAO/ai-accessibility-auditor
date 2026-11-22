import { lazy, Suspense, useState } from "react"
import { Glasses, ImageOff, MapPin } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop, useObjectUrl } from "@/lib/hooks"
import type { Report } from "@/lib/report"
import { useScreenshotBlob } from "@/lib/scans"
import { useViewer } from "./viewer-store"

// The viewer (and its overlay logic) is only fetched when a report with a screenshot is shown
const ScreenshotViewer = lazy(() => import("./screenshot-viewer"))
// The vision simulator (SVG filters, explanations) only loads when someone opens it
const VisionSimulator = lazy(() => import("./vision-simulator"))

function Loaded({ report }: { report: Report }) {
  const [view, setView] = useState<"map" | "vision">("map")
  const [visionSeen, setVisionSeen] = useState(false)
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
  const pick = (v: "map" | "vision") => {
    setView(v)
    if (v === "vision") setVisionSeen(true)
  }
  const tab = (v: "map" | "vision", label: string, Icon: typeof MapPin) => (
    <button
      type="button" aria-pressed={view === v} onClick={() => pick(v)}
      className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${view === v ? "bg-foreground text-background" : "hover:bg-accent"}`}
    >
      <Icon className="size-4" aria-hidden="true" />{label}
    </button>
  )
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div role="group" aria-label="Screenshot view" className="inline-flex self-start rounded-xl border-2 border-input p-0.5">
        {tab("map", "Issue map", MapPin)}{tab("vision", "Vision simulator", Glasses)}
      </div>
      {/* Both views stay mounted once opened, so zoom and selection survive switching */}
      <div className="min-h-0 flex-1" hidden={view !== "map"}>
        <Suspense fallback={<Skeleton className="h-full min-h-72 w-full rounded-2xl" aria-hidden="true" />}>
          <ScreenshotViewer report={report} src={src} />
        </Suspense>
      </div>
      {visionSeen && (
        <div className="min-h-0 flex-1 overflow-y-auto" hidden={view !== "vision"}>
          <Suspense fallback={<Skeleton className="h-full min-h-72 w-full rounded-2xl" aria-hidden="true" />}>
            <VisionSimulator report={report} src={src} />
          </Suspense>
        </div>
      )}
    </div>
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
