import { lazy, Suspense } from "react"
import { RotateCw, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/lib/api"
import { useReport } from "@/lib/report"
import { useReportFilters, type ReportTab } from "@/lib/report-filters"
import type { Scan } from "@/lib/scans"
import { IssuesTab } from "./issues-tab"
import { PassedTab } from "./passed-tab"
import { ReportHeader } from "./report-header"
import { ReportHero } from "./report-hero"
import { ReviewTab } from "./review-tab"
import { ViewerProvider } from "./viewer-provider"

// Charts are below the fold: fetched after the hero is on screen
const ReportCharts = lazy(() => import("./report-charts"))

function ReportSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading report…</span>
      <div className="flex gap-4"><Skeleton className="size-14 rounded-2xl" /><div className="flex-1 space-y-3"><Skeleton className="h-10 w-2/3 rounded-xl" /><Skeleton className="h-5 w-1/2 rounded-md" /></div></div>
      <Skeleton className="h-72 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  )
}

const TAB_CLASS =
  "h-12 flex-none cursor-pointer rounded-none border-b-4 border-transparent px-4 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary data-[active]:text-foreground"

export default function ReportView({ scan }: { scan: Scan }) {
  const { data: report, isPending, isError, error, refetch, isFetching } = useReport(scan.id, true)
  const { tab, update } = useReportFilters()

  if (isPending) return <ReportSkeleton />
  if (isError) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div role="alert" className="mx-auto max-w-lg py-16 text-center">
        <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 font-display text-4xl font-semibold">{missing ? "Report not found" : "Couldn't load the report"}</h1>
        <p className="mt-2 text-muted-foreground">{error instanceof ApiError ? error.message : "Something went wrong."}</p>
        {!missing && <Button className="mt-6" disabled={isFetching} onClick={() => void refetch()}><RotateCw aria-hidden="true" />Try again</Button>}
      </div>
    )
  }

  return (
    <ViewerProvider>
      <div className="space-y-8">
        <ReportHeader report={report} />
        <ReportHero report={report} />
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-3xl" aria-hidden="true" />}>
          <ReportCharts report={report} />
        </Suspense>

        <Tabs value={tab} onValueChange={(v) => update({ tab: v as ReportTab })} className="gap-6">
          <TabsList variant="line" aria-label="Report sections" className="h-auto w-full justify-start overflow-x-auto border-b border-border p-0">
            <TabsTrigger value="issues" className={TAB_CLASS}>Issues <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{report.counts.issues}</span></TabsTrigger>
            <TabsTrigger value="review" className={TAB_CLASS}>Needs review <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{report.counts.review}</span></TabsTrigger>
            <TabsTrigger value="passed" className={TAB_CLASS}>Passed <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{report.counts.passed}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="issues"><IssuesTab report={report} /></TabsContent>
          <TabsContent value="review"><ReviewTab report={report} /></TabsContent>
          <TabsContent value="passed"><PassedTab report={report} /></TabsContent>
        </Tabs>
      </div>
    </ViewerProvider>
  )
}
