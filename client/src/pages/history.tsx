import { useCallback, useEffect, useMemo, useState } from "react"
import { History as HistoryIcon, Loader2, RotateCcw, RotateCw, ScanSearch, Search } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { HistoryRow } from "@/components/history/history-row"
import { DeleteScanDialog } from "@/components/report/delete-scan-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { useDebounced } from "@/lib/hooks"
import { DEFAULT_HISTORY, useRescan, useScanHistory, type HistoryFilters } from "@/lib/report"
import type { Scan } from "@/lib/scans"
import { useNow } from "@/lib/time"
import { hostOf } from "@/lib/url"

interface Option { value: string; label: string }
const ALL = "all"
const STATUS: Option[] = [{ value: ALL, label: "Any status" }, { value: "COMPLETED", label: "Completed" }, { value: "FAILED", label: "Failed" }, { value: "CANCELLED", label: "Cancelled" }, { value: "RUNNING", label: "Running" }, { value: "QUEUED", label: "Queued" }]
const VIEWPORT: Option[] = [{ value: ALL, label: "Any screen" }, { value: "DESKTOP", label: "Desktop" }, { value: "MOBILE", label: "Mobile" }]
const SORT: Option[] = [{ value: "date:desc", label: "Newest first" }, { value: "date:asc", label: "Oldest first" }, { value: "score:desc", label: "Highest score" }, { value: "score:asc", label: "Lowest score" }]

function Pick({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <div className="grid min-w-40 flex-1 gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(String(v))} items={options}>
        <SelectTrigger aria-label={label} className="h-11 w-full bg-card px-3 text-base"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value} className="cursor-pointer py-2 text-base">{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}

/** 0–100 or empty */
const scoreParam = (v: string) => (v === "" ? "" : String(Math.max(0, Math.min(100, Math.round(Number(v) || 0)))))

export default function History() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const now = useNow(true, 30_000)
  const rescan = useRescan()
  const [deleting, setDeleting] = useState<Scan | null>(null)

  // Filters live in the URL so a filtered view can be shared or bookmarked
  const filters = useMemo<HistoryFilters>(() => ({
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    viewport: params.get("viewport") ?? "",
    minScore: params.get("minScore") ?? "",
    maxScore: params.get("maxScore") ?? "",
    sort: params.get("sort") === "score" ? "score" : "date",
    order: params.get("order") === "asc" ? "asc" : "desc",
  }), [params])

  // Built from the CURRENT url (router functional updates are not queued, so quick successive changes would clobber each other)
  const set = useCallback((patch: Partial<HistoryFilters>) => setParams(() => {
    const next = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === undefined || v === DEFAULT_HISTORY[k as keyof HistoryFilters]) next.delete(k)
      else next.set(k, String(v))
    }
    return next
  }, { replace: true }), [setParams])

  const [text, setText] = useState(filters.q)
  const debounced = useDebounced(text)
  /* eslint-disable react-hooks/set-state-in-effect -- keeping the search box and the URL in sync */
  useEffect(() => { if (debounced === text && debounced.trim() !== filters.q) set({ q: debounced.trim() }) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [debounced])
  useEffect(() => { if (filters.q === "") setText("") }, [filters.q])
  /* eslint-enable react-hooks/set-state-in-effect */

  const history = useScanHistory(filters)
  const items = history.data?.pages.flatMap((p) => p.items) ?? []
  const active = !!(filters.q || filters.status || filters.viewport || filters.minScore || filters.maxScore || filters.sort !== "date" || filters.order !== "desc")
  const clear = () => setParams({}, { replace: true })

  const doRescan = (s: Scan) =>
    rescan.mutate(s.id, { onSuccess: (n) => navigate(`/scans/${n.id}`), onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't start the scan.") })

  return (
    <section className="container-page py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl font-semibold sm:text-5xl"><HistoryIcon className="size-8" aria-hidden="true" />All scans</h1>
          <p className="mt-2 max-w-xl text-lg text-muted-foreground">Every site you've scanned. Open one for its full report, or run it again.</p>
        </div>
        <Link to="/dashboard" className={buttonVariants()}><ScanSearch aria-hidden="true" />New scan</Link>
      </div>

      <section aria-label="Filter scans" className="mt-8 space-y-4 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
        <div className="grid gap-1.5">
          <label htmlFor="history-search" className="text-sm font-semibold">Search by address or page title</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="history-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="example.com" className="pl-11" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Pick label="Status" value={filters.status || ALL} options={STATUS} onChange={(v) => set({ status: v === ALL ? "" : v })} />
          <Pick label="Screen" value={filters.viewport || ALL} options={VIEWPORT} onChange={(v) => set({ viewport: v === ALL ? "" : v })} />
          <Pick label="Sort by" value={`${filters.sort}:${filters.order}`} options={SORT} onChange={(v) => { const [sort, order] = v.split(":"); set({ sort: sort as "date", order: order as "asc" }) }} />
          <div className="grid min-w-40 flex-1 gap-1.5">
            <span id="score-range" className="text-sm font-semibold">Score range</span>
            <div role="group" aria-labelledby="score-range" className="flex items-center gap-2">
              <Input aria-label="Minimum score" type="number" inputMode="numeric" min={0} max={100} placeholder="0" value={filters.minScore} onChange={(e) => set({ minScore: scoreParam(e.target.value) })} className="h-11" />
              <span aria-hidden="true">–</span>
              <Input aria-label="Maximum score" type="number" inputMode="numeric" min={0} max={100} placeholder="100" value={filters.maxScore} onChange={(e) => set({ maxScore: scoreParam(e.target.value) })} className="h-11" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-base font-medium">
            {history.isPending ? "Loading scans…" : `${items.length} ${items.length === 1 ? "scan" : "scans"} shown${history.hasNextPage ? ", more available" : ""}`}
          </p>
          {active && <Button variant="ghost" size="sm" onClick={clear}><RotateCcw aria-hidden="true" />Clear filters</Button>}
        </div>
        {(filters.sort === "score" || filters.minScore || filters.maxScore) && <p className="text-sm text-muted-foreground">Scans without a score (running, failed or cancelled) are left out when sorting or filtering by score.</p>}
      </section>

      <div className="mt-6">
        {history.isPending && (
          <div role="status" className="space-y-3"><span className="sr-only">Loading your scans…</span>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
        )}

        {history.isError && (
          <div role="alert" className="rounded-2xl border-2 border-critical/50 bg-critical-soft p-5 text-critical">
            <p className="font-semibold">We couldn't load your scans.</p>
            <Button variant="outline" size="sm" disabled={history.isFetching} onClick={() => void history.refetch()} className="mt-3 border-critical/50 text-critical"><RotateCw aria-hidden="true" />Try again</Button>
          </div>
        )}

        {history.data && items.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-3xl font-semibold">{active ? "No scans match" : "No scans yet"}</p>
            <p className="mt-2 text-muted-foreground">{active ? "Try a different search or clear the filters." : "Scan your first website and it will be listed here."}</p>
            {active ? <Button className="mt-5" variant="outline" onClick={clear}>Clear filters</Button> : <Link to="/dashboard" className={`${buttonVariants()} mt-5`}>Scan a website</Link>}
          </div>
        )}

        {items.length > 0 && <h2 className="sr-only">Your scans</h2>}
        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map((s) => <HistoryRow key={s.id} scan={s} now={now} busy={rescan.isPending} onRescan={doRescan} onDelete={setDeleting} />)}
          </ul>
        )}

        {history.hasNextPage && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="lg" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
              {history.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}Load more
            </Button>
          </div>
        )}
      </div>

      {deleting && <DeleteScanDialog scanId={deleting.id} label={deleting.pageTitle || hostOf(deleting.normalizedUrl)} open onOpenChange={(o) => !o && setDeleting(null)} />}
    </section>
  )
}
