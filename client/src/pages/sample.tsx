import { lazy, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, ExternalLink, FlaskConical, SearchX } from "lucide-react"
import { Link } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { get } from "@/lib/api"
import type { Report } from "@/lib/report"
import { ReportSourceCtx } from "@/lib/report-source"
import { useSeo } from "@/lib/seo"
import { ROUTE_META } from "@/lib/seo-routes"

const ReportBody = lazy(() => import("@/components/report/report-view").then((m) => ({ default: m.ReportBody })))
// Absolute: relative URLs would be prefixed with the API base by the HTTP client
const REPORT_URL = () => new URL("/demo/report.json", window.location.origin).href

/** A frozen, real report of W3C's deliberately inaccessible demo page. Static files only: no login, no server calls. */
export default function SampleReport() {
  useSeo(ROUTE_META.sample)
  const q = useQuery({ queryKey: ["demo-report"], staleTime: Infinity, retry: 1, queryFn: () => get<{ report: Report }>(REPORT_URL()) })

  // min-height: the report grows as its parts load, and the footer must not jump up and down while it does
  return (
    <section className="container-page min-h-[130dvh] max-w-[92rem] py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card/90 p-5 shadow-soft">
        <FlaskConical className="size-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Sample report</h1>
          <p className="mt-1 text-muted-foreground">
            A saved scan of W3C&apos;s deliberately inaccessible{" "}
            <a href="https://www.w3.org/WAI/demos/bad/" target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-link underline underline-offset-4">&ldquo;Before and After&rdquo; demonstration<ExternalLink className="ml-1 inline size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>.
            Everything is clickable, nothing here uses your account.
          </p>
        </div>
        <Link to="/signup" className={buttonVariants({ size: "lg" })}>Scan your own site<ArrowRight aria-hidden="true" /></Link>
      </div>

      {q.isPending && <div role="status" className="space-y-4"><span className="sr-only">Loading the sample report…</span><Skeleton className="h-72 w-full rounded-3xl" /><Skeleton className="h-64 w-full rounded-3xl" /></div>}
      {q.isError && (
        <div role="alert" className="mx-auto max-w-lg py-16 text-center">
          <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-3xl font-semibold">The sample couldn&apos;t load</h2>
          <p className="mt-2 text-muted-foreground">Please refresh the page.</p>
        </div>
      )}
      {q.data && (
        <ReportSourceCtx value={{ base: "/demo", readOnly: true, static: true }}>
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" aria-hidden="true" />}>
            <ReportBody report={q.data.report} header={null} />
          </Suspense>
        </ReportSourceCtx>
      )}
    </section>
  )
}
