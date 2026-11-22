import { useEffect, useMemo, useState } from "react"
import { PartyPopper, SearchX, ScanEye } from "lucide-react"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { useMotionScale } from "@/lib/motion"
import type { Report } from "@/lib/report"
import { filterRules, useReportFilters } from "@/lib/report-filters"
import { IssueFilterBar } from "./issue-filters"
import { RuleCard } from "./rule-card"
import { ViewerPanel } from "./viewer-panel"
import { useViewer } from "./viewer-store"

export function IssuesTab({ report }: { report: Report }) {
  const { filters, update, reset, active } = useReportFilters()
  const { listNonce, selectedId, setSheetOpen } = useViewer()
  const { reduced } = useMotionScale()
  const visible = useMemo(() => filterRules(report.rules, filters), [report.rules, filters])
  const markerById = useMemo(() => new Map(report.markers.map((m) => [m.id, m])), [report.markers])
  const [open, setOpen] = useState<string[]>(() => (report.rules[0] ? [report.rules[0].id] : []))

  // A marker was clicked on the screenshot: make sure its rule is shown and open, and bring the card into view
  /* eslint-disable react-hooks/set-state-in-effect -- reacting to a click in another component */
  useEffect(() => {
    if (!listNonce || !selectedId) return
    const marker = markerById.get(selectedId)
    if (!marker) return
    if (!visible.some((r) => r.id === marker.ruleId)) reset()
    setOpen((o) => (o.includes(marker.ruleId) ? o : [...o, marker.ruleId]))
    const id = setTimeout(() => document.querySelector(`[data-rule-id="${marker.ruleId}"]`)?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }), 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new click is a trigger
  }, [listNonce])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (report.rules.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-10 text-center">
        <PartyPopper className="mx-auto size-10" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl font-semibold">No accessibility issues found</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Every automated check passed. Automated tools find roughly a third of real-world problems, so also look at the {report.counts.review} item{report.counts.review === 1 ? "" : "s"} under “Needs review” and try the page with a keyboard and a screen reader.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="min-w-0 space-y-5">
        <h2 className="sr-only">Issues</h2>
        <IssueFilterBar report={report} filters={filters} active={active} shown={visible.length} onChange={update} onReset={reset} />

        {report.screenshot && (
          <Button variant="outline" className="lg:hidden" onClick={() => setSheetOpen(true)}><ScanEye aria-hidden="true" />Open screenshot viewer</Button>
        )}

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-display text-2xl font-semibold">No issues match these filters</p>
            <Button className="mt-4" variant="outline" onClick={reset}>Clear filters</Button>
          </div>
        ) : (
          <Accordion multiple value={open} onValueChange={(v) => setOpen(v as string[])} className="gap-3">
            {visible.map((rule) => <RuleCard key={rule.id} rule={rule} scanId={report.scan.id} markerById={markerById} />)}
          </Accordion>
        )}
      </div>

      <div className="contents lg:block">
        <ViewerPanel report={report} />
      </div>
    </div>
  )
}
