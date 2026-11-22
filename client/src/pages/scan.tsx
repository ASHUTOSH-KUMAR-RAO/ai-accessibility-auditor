import { lazy, Suspense } from "react"
import { ArrowLeft, RotateCw, SearchX } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { ScanProblem } from "@/components/scans/scan-problem"
import { ScanProgress } from "@/components/scans/scan-progress"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { isActive, useScan } from "@/lib/scans"
import { hostOf } from "@/lib/url"

// The report (charts, viewer, syntax highlighter) only loads for finished scans
const ReportView = lazy(() => import("@/components/report/report-view"))

const TITLES = { QUEUED: "Scanning", RUNNING: "Scanning", FAILED: "Couldn't scan", CANCELLED: "Cancelled scan of" } as const

export default function ScanPage() {
  const { id = "" } = useParams()
  const { data: scan, isPending, isError, error, refetch, isFetching } = useScan(id)
  const completed = scan?.status === "COMPLETED"

  return (
    <section className={`container-page py-10 sm:py-14 ${completed ? "max-w-[92rem]" : ""}`}>
      <Link to="/scans" className="mb-6 inline-flex items-center gap-2 rounded-lg py-1 font-medium text-link underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />All scans
      </Link>

      {isPending && (
        <div role="status" className="space-y-4">
          <span className="sr-only">Loading scan…</span>
          <Skeleton className="h-12 w-2/3 rounded-xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      )}

      {isError && (
        <div role="alert" className="mx-auto max-w-lg py-16 text-center">
          <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          {error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
            <>
              <h1 className="mt-4 font-display text-4xl font-semibold">Scan not found</h1>
              <p className="mt-2 text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
              <Link to="/scans" className={`${buttonVariants()} mt-6`}>Back to all scans</Link>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-display text-4xl font-semibold">Couldn't load this scan</h1>
              <p className="mt-2 text-muted-foreground">{error instanceof ApiError ? error.message : "Something went wrong."}</p>
              <Button className="mt-6" disabled={isFetching} onClick={() => void refetch()}><RotateCw aria-hidden="true" />Try again</Button>
            </>
          )}
        </div>
      )}

      {scan && completed && (
        <Suspense fallback={<div role="status"><span className="sr-only">Loading report…</span><Skeleton className="h-96 w-full rounded-3xl" /></div>}>
          <ReportView scan={scan} />
        </Suspense>
      )}

      {scan && !completed && (
        <>
          <h1 className="break-words font-display text-4xl font-semibold sm:text-5xl">
            {TITLES[scan.status as keyof typeof TITLES]} <span className="italic">{hostOf(scan.normalizedUrl)}</span>
          </h1>
          <p role="status" className="sr-only">{scan.status === "FAILED" ? "The scan failed." : scan.status === "CANCELLED" ? "The scan was cancelled." : ""}</p>
          <div className="mt-8">
            {isActive(scan.status) && <ScanProgress scan={scan} />}
            {(scan.status === "FAILED" || scan.status === "CANCELLED") && <ScanProblem scan={scan} />}
          </div>
        </>
      )}
    </section>
  )
}
