import { Suspense, lazy } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, Clock, ExternalLink, Globe, Link2Off, Lock, Monitor, Smartphone } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, get } from "@/lib/api"
import type { Report } from "@/lib/report"
import { ReportSourceCtx } from "@/lib/report-source"
import { hostOf } from "@/lib/url"

const ReportBody = lazy(() => import("@/components/report/report-view").then((m) => ({ default: m.ReportBody })))
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

interface PublicReport { report: Report; share: { expiresAt: string | null; hideScreenshot: boolean } }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="container-page flex h-16 max-w-[92rem] items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm font-semibold sm:inline-flex"><Lock className="size-4" aria-hidden="true" />Shared, read-only</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container-page max-w-[92rem] overflow-x-clip py-10 outline-none sm:py-14">{children}</main>
      <footer className="container-page max-w-[92rem] pb-10 text-sm text-muted-foreground">
        This report was shared with you from AccessLens. <Link to="/" className="font-medium text-link underline underline-offset-4">Scan your own site</Link>
      </footer>
    </>
  )
}

function Header({ report, share }: PublicReport) {
  const { scan } = report
  const url = scan.finalUrl ?? scan.url
  const Device = scan.viewport === "MOBILE" ? Smartphone : Monitor
  const when = scan.completedAt ?? scan.createdAt
  return (
    <header className="flex min-w-0 gap-4">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-hidden="true">
        {scan.favicon ? <img src={scan.favicon} alt="" className="size-8 object-contain" /> : <Globe className="size-7 text-muted-foreground" />}
      </div>
      <div className="min-w-0">
        <h1 className="break-words font-display text-4xl font-semibold leading-tight sm:text-5xl">{scan.pageTitle || hostOf(url)}</h1>
        {/* no referrer is sent, so the share token never leaks to the scanned site */}
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="mt-1.5 inline-flex max-w-full items-center gap-1.5 break-all text-link underline underline-offset-4">
          {url}<ExternalLink className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
        </a>
        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
          <li className="inline-flex items-center gap-1.5"><Device className="size-4" aria-hidden="true" />{scan.viewport === "MOBILE" ? "Mobile · 390 × 844" : "Desktop · 1280 × 800"}</li>
          <li className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" /><span className="sr-only">Scanned </span><time dateTime={when}>{dateFmt.format(new Date(when))}</time></li>
          {share.expiresAt && <li className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />Link expires <time dateTime={share.expiresAt}>{dateFmt.format(new Date(share.expiresAt))}</time></li>}
        </ul>
      </div>
    </header>
  )
}

export default function PublicReportPage() {
  const { token = "" } = useParams()
  const q = useQuery({
    queryKey: ["public", token],
    staleTime: 60_000,
    retry: (n, err) => !(err instanceof ApiError && err.status && err.status < 500) && n < 2,
    queryFn: () => get<PublicReport>(`/public/${encodeURIComponent(token)}/report`),
  })

  return (
    <Shell>
      {/* never indexed, never leaks the token in a Referer header */}
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
      <title>{q.data ? `Accessibility report: ${q.data.report.scan.pageTitle || hostOf(q.data.report.scan.url)} | AccessLens` : "Shared accessibility report | AccessLens"}</title>

      {q.isPending && (
        <div role="status" className="space-y-4">
          <span className="sr-only">Loading the shared report…</span>
          <Skeleton className="h-14 w-2/3 rounded-xl" /><Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      )}
      {q.isError && (
        <div role="alert" className="mx-auto max-w-lg py-16 text-center">
          <Link2Off className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 font-display text-4xl font-semibold">This link doesn't work</h1>
          <p className="mt-2 text-muted-foreground">{q.error instanceof ApiError && q.error.status === 404 ? "It is invalid, has expired, or was revoked by its owner. Ask them for a new link." : "We couldn't load the report. Please try again in a moment."}</p>
          <Link to="/" className={`${buttonVariants()} mt-6`}>Go to AccessLens</Link>
        </div>
      )}
      {q.data && (
        <ReportSourceCtx value={{ base: `/public/${encodeURIComponent(token)}`, readOnly: true }}>
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" aria-hidden="true" />}>
            <ReportBody report={q.data.report} header={<Header {...q.data} />} />
          </Suspense>
        </ReportSourceCtx>
      )}
    </Shell>
  )
}
