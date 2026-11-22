import { useEffect } from "react"
import { Loader2, RotateCw, Sparkles, TriangleAlert, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiSummary } from "@/lib/ai"
import type { Report } from "@/lib/report"
import { DegradedHint, EffortChip, RateLimitNotice, Sparkle } from "./ai-badges"
import { useAiFixPanel } from "./fix-context"

function SummarySkeleton() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Writing the AI summary…</span>
      <Skeleton className="ai-shimmer h-7 w-4/5 rounded-md" />
      <Skeleton className="ai-shimmer h-7 w-3/5 rounded-md" />
      <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="ai-shimmer h-28 rounded-2xl" />)}</div>
    </div>
  )
}

/** Executive summary of the whole scan: verdict, top 3 priorities, quick wins, who is most affected. */
export function AiSummaryCard({ report }: { report: Report }) {
  const { stored, generate } = useAiSummary(report.scan.id)
  const { openRule } = useAiFixPanel()
  const ruleIds = new Set(report.rules.map((r) => r.id))

  // First visit: nothing stored yet, so create it (one AI generation, then it is saved for this scan).
  useEffect(() => {
    if (stored.isSuccess && stored.data === null && generate.isIdle) generate.mutate(false)
  }, [stored.isSuccess, stored.data, generate])

  const data = generate.data ?? stored.data ?? null
  const busy = generate.isPending
  const failed = (stored.isError || generate.isError) && !data
  const retry = () => (stored.isError ? void stored.refetch() : generate.mutate(false))

  return (
    <section aria-labelledby="ai-summary-heading" aria-busy={busy} className="space-y-5 rounded-3xl border border-border bg-card/90 p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-1.5"><Sparkle />AI summary</p>
          <h2 id="ai-summary-heading" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">What to do first</h2>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm font-semibold">{data.source === "ai" ? "Written by AI" : "Guided summary (no AI)"}</span>
            {data.cached && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium">Saved result</span>}
          </div>
        )}
        <Button variant="outline" onClick={() => generate.mutate(true)} disabled={busy || stored.isPending || !data}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}Regenerate<span className="sr-only"> AI summary</span>
        </Button>
      </div>

      {(stored.isPending || (busy && !data)) && <SummarySkeleton />}

      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">
          <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 font-semibold">Couldn't create the summary. The report below is unaffected.</p>
          <Button variant="outline" size="sm" className="border-critical/50 text-critical" onClick={retry}><RotateCw aria-hidden="true" />Try again</Button>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {data.rateLimit && <RateLimitNotice rateLimit={data.rateLimit} what="summary" />}
          <DegradedHint reason={data.fallbackReason} />
          <p className="font-display text-xl leading-snug sm:text-2xl">{data.summary.verdict}</p>

          <div>
            <h3 className="mb-3 text-base font-semibold">Top priorities</h3>
            <ol className="grid gap-3 md:grid-cols-3">
              {data.summary.priorities.map((p, i) => (
                <li key={`${p.ruleId}-${p.title}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-8 place-content-center rounded-full border-2 border-foreground font-bold" aria-hidden="true">{i + 1}</span>
                    <EffortChip effort={p.effort} />
                  </div>
                  <h4 className="font-sans text-base font-semibold leading-snug">{p.title}</h4>
                  <p className="flex-1 text-muted-foreground">{p.why}</p>
                  {p.ruleId && ruleIds.has(p.ruleId) && (
                    <Button variant="outline" size="sm" className="self-start" onClick={() => openRule(p.ruleId!)}>
                      <Sparkles aria-hidden="true" />Fix with AI<span className="sr-only"> for {p.title}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {data.summary.quickWins.length > 0 && (
              <div>
                <h3 className="mb-2 text-base font-semibold">Quick wins</h3>
                <ul className="space-y-1.5">
                  {data.summary.quickWins.map((w) => <li key={w} className="flex gap-2"><Zap className="mt-1 size-4 shrink-0" aria-hidden="true" />{w}</li>)}
                </ul>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-base font-semibold">Who is most affected</h3>
              <p className="flex gap-2"><Users className="mt-1 size-4 shrink-0" aria-hidden="true" />{data.summary.mostAffected}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
