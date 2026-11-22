import { useEffect, useState } from "react"
import { RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDebounced } from "@/lib/hooks"
import { LEVEL_LABEL, PRINCIPLE_LABEL, type PrincipleOrOther, type Report, type RuleLevel } from "@/lib/report"
import type { IssueFilters, IssueSort } from "@/lib/report-filters"
import { SEVERITIES, SEVERITY, type Severity } from "@/lib/severity"
import { cn } from "@/lib/utils"

interface Option { value: string; label: string }

function Pick({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <div className="grid min-w-40 flex-1 gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(String(v))} items={options}>
        <SelectTrigger aria-label={label} className="h-11 w-full bg-card px-3 text-base"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value} className="cursor-pointer py-2 text-base">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

const ALL = "all"

export function IssueFilterBar({
  report, filters, active, shown, onChange, onReset,
}: {
  report: Report
  filters: IssueFilters
  active: boolean
  shown: number
  onChange: (patch: Partial<IssueFilters>) => void
  onReset: () => void
}) {
  // The search box edits local state; the URL is updated after a short pause
  const [text, setText] = useState(filters.q)
  const debounced = useDebounced(text)
  /* eslint-disable react-hooks/set-state-in-effect -- keeping the box and the URL in sync */
  useEffect(() => {
    // `debounced === text`: ignore a stale debounced value after the box was reset (e.g. "Clear filters")
    if (debounced === text && debounced.trim() !== filters.q) onChange({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced text is a trigger
  }, [debounced])
  useEffect(() => {
    if (filters.q === "") setText("") // "Clear filters" / link without ?q
  }, [filters.q])
  /* eslint-enable react-hooks/set-state-in-effect */

  const principleOptions: Option[] = [{ value: ALL, label: "All principles" }, ...report.principles.map((p) => ({ value: p.id, label: `${PRINCIPLE_LABEL[p.id]} (${p.rules})` }))]
  const levelOptions: Option[] = [{ value: ALL, label: "All levels" }, ...report.levels.map((l) => ({ value: l.id, label: `${LEVEL_LABEL[l.id]} (${l.rules})` }))]
  const sortOptions: Option[] = [{ value: "severity", label: "Severity" }, { value: "elements", label: "Most elements" }]

  return (
    <section aria-label="Filter issues" className="space-y-4 rounded-2xl border border-border bg-card/70 p-4">
      <div className="grid gap-1.5">
        <label htmlFor="issue-search" className="text-sm font-semibold">Search issues</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="issue-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Title, rule or WCAG number, e.g. 1.4.3" className="pl-11" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <span id="sev-filter-label" className="text-sm font-semibold">Severity</span>
        <ToggleGroup
          multiple aria-labelledby="sev-filter-label" spacing={1.5} className="flex-wrap"
          value={filters.severities} onValueChange={(v) => onChange({ severities: v as Severity[] })}
        >
          {SEVERITIES.map((s) => {
            const { icon: Icon, label, iconClass, chip } = SEVERITY[s]
            const rules = report.severity.find((x) => x.impact === s)?.rules ?? 0
            return (
              <ToggleGroupItem
                key={s} value={s}
                className={cn("h-11 cursor-pointer gap-2 rounded-xl border-2 px-3.5 text-base font-semibold data-[pressed]:text-foreground", chip, "border-border bg-card data-[pressed]:border-foreground data-[pressed]:bg-accent")}
              >
                <Icon className={cn("size-4", iconClass)} aria-hidden="true" />{label}<span className="tabular-nums text-muted-foreground">{rules}<span className="sr-only"> {rules === 1 ? "rule" : "rules"}</span></span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap gap-3">
        <Pick label="WCAG principle" value={filters.principle ?? ALL} options={principleOptions} onChange={(v) => onChange({ principle: v === ALL ? null : (v as PrincipleOrOther) })} />
        <Pick label="Level" value={filters.level ?? ALL} options={levelOptions} onChange={(v) => onChange({ level: v === ALL ? null : (v as RuleLevel) })} />
        <Pick label="Sort by" value={filters.sort} options={sortOptions} onChange={(v) => onChange({ sort: v as IssueSort })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-base font-medium">
          {shown} of {report.rules.length} issue {report.rules.length === 1 ? "type" : "types"} shown
        </p>
        {active && <Button variant="ghost" size="sm" onClick={onReset}><RotateCcw aria-hidden="true" />Clear filters</Button>}
      </div>
    </section>
  )
}
