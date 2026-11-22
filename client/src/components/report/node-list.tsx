import { useEffect, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { CircleCheck, Crosshair, Loader2, MapPinOff, RotateCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiFixPanel } from "@/components/ai/fix-context"
import { useMotionScale } from "@/lib/motion"
import { useReportSource } from "@/lib/report-source"
import { useRuleNodes, type Marker, type ReportRule, type RuleNode } from "@/lib/report"
import { SEVERITY } from "@/lib/severity"
import { parseFailureSummary } from "@/lib/failure-summary"
import { cn } from "@/lib/utils"
import { CodeSnippet } from "./code-snippet"
import { CopyButton } from "./copy-button"
import { useViewer } from "./viewer-store"

const VIRTUALIZE_OVER = 25

function FailureChecklist({ summary }: { summary: string }) {
  const groups = parseFailureSummary(summary)
  if (groups.length === 0) return null
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="text-sm font-semibold">{g.title}</p>
          <ul className="mt-1 space-y-1">
            {g.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function NodeRow({ node, marker, rule, index, total }: { node: RuleNode; marker: Marker | undefined; rule: ReportRule; index: number; total: number }) {
  const { selectedId, showOnPage } = useViewer()
  const { openNode } = useAiFixPanel()
  const { readOnly } = useReportSource()
  const selected = selectedId === node.id
  const meta = SEVERITY[rule.impact]
  const label = `element ${index + 1} of ${total}`

  return (
    <div
      id={`node-${node.id}`}
      tabIndex={-1}
      className={cn("space-y-3 rounded-2xl border bg-background/70 p-4 outline-none transition-shadow", selected ? "border-ring shadow-glow ring-2 ring-ring" : "border-border")}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {marker ? (
          <span className="inline-flex items-center gap-1 rounded-md border-2 bg-card px-1.5 text-sm font-bold" style={{ borderColor: `var(${meta.cssVar})` }}>
            <meta.icon className={cn("size-3.5", meta.iconClass)} aria-hidden="true" />
            <span className="sr-only">Marker </span>{marker.n}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPinOff className="size-4" aria-hidden="true" />Not located on the page</span>
        )}
        <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">{node.selector}</code>
        <CopyButton text={node.selector} label={`Copy selector for ${label}`} />
      </div>

      <CodeSnippet code={node.html} label={`HTML of ${label}`} />
      <FailureChecklist summary={node.failureSummary} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!marker} onClick={() => showOnPage(node.id)} aria-label={`Show on page: ${label}`}>
          <Crosshair aria-hidden="true" />Show on page
        </Button>
        <Button variant="outline" size="sm" onClick={() => openNode(rule.id, node.id)} aria-label={`${readOnly ? "View AI fix" : "AI fix"} for ${label}`}>
          <Sparkles aria-hidden="true" />{readOnly ? "View AI fix" : "AI fix"}
        </Button>
      </div>
    </div>
  )
}

/** The affected elements of one rule. Loaded when the card opens; virtualized once the list gets long. */
export function NodeList({ scanId, rule, markerById }: { scanId: string; rule: ReportRule; markerById: Map<string, Marker> }) {
  const q = useRuleNodes(scanId, rule.id, true)
  const { selectedId, listNonce } = useViewer()
  const { reduced } = useMotionScale()
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const scroller = useRef<HTMLDivElement>(null)
  const virtual = items.length > VIRTUALIZE_OVER
  const rowVirtualizer = useVirtualizer({ count: virtual ? items.length : 0, getScrollElement: () => scroller.current, estimateSize: () => 340, overscan: 3 })

  // A marker was clicked: scroll to its row and move focus there
  useEffect(() => {
    if (!listNonce || !selectedId) return
    const index = items.findIndex((n) => n.id === selectedId)
    if (index < 0) return
    if (virtual) rowVirtualizer.scrollToIndex(index, { align: "center" })
    const id = setTimeout(() => {
      const el = document.getElementById(`node-${selectedId}`)
      el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" })
      el?.focus({ preventScroll: true })
    }, virtual ? 80 : 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new click is a trigger
  }, [listNonce, items.length])

  if (q.isPending) return <div role="status" className="space-y-3"><span className="sr-only">Loading elements…</span><Skeleton className="h-40 w-full rounded-2xl" /></div>
  if (q.isError) {
    return (
      <div role="alert" className="rounded-xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">
        <p className="font-semibold">Couldn't load the affected elements.</p>
        <Button variant="outline" size="sm" className="mt-2 border-critical/50 text-critical" onClick={() => void q.refetch()}><RotateCw aria-hidden="true" />Try again</Button>
      </div>
    )
  }

  const row = (n: RuleNode, i: number) => <NodeRow node={n} marker={markerById.get(n.id)} rule={rule} index={i} total={items.length} />

  return (
    <div className="space-y-3">
      {rule.totalNodes > rule.storedNodes && (
        <p className="text-sm text-muted-foreground">
          Showing {rule.approximate ? "the saved sample of" : `the first ${rule.storedNodes} of`} {rule.approximate ? items.length : rule.totalNodes} affected elements. All of them are counted in the score.
        </p>
      )}
      {virtual ? (
        <div ref={scroller} tabIndex={0} role="group" aria-label={`${items.length} affected elements, scrollable`} className="max-h-[36rem] overflow-auto rounded-2xl">
          <ul className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((v) => (
              <li
                key={items[v.index]!.id} ref={rowVirtualizer.measureElement} data-index={v.index} aria-setsize={items.length} aria-posinset={v.index + 1}
                className="absolute inset-x-0 top-0 pb-3" style={{ transform: `translateY(${v.start}px)` }}
              >
                {row(items[v.index]!, v.index)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-3">{items.map((n, i) => <li key={n.id}>{row(n, i)}</li>)}</ul>
      )}
      {q.hasNextPage && (
        <Button variant="outline" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}Load more elements
        </Button>
      )}
    </div>
  )
}
