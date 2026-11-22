import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import type { PrincipleOrOther, ReportRule, RuleLevel } from "@/lib/report"
import { SEVERITIES, severityRank, type Severity } from "@/lib/severity"

export type ReportTab = "issues" | "review" | "passed" | "keyboard"
export type IssueSort = "severity" | "elements"

export interface IssueFilters {
  severities: Severity[]
  principle: PrincipleOrOther | null
  level: RuleLevel | null
  q: string
  sort: IssueSort
}

const PRINCIPLES = ["perceivable", "operable", "understandable", "robust", "best-practice"] as const
const LEVELS = ["A", "AA", "best-practice"] as const
const TABS = ["issues", "review", "passed", "keyboard"] as const

const oneOf = <T extends string>(allowed: readonly T[], v: string | null): T | null => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null)

/** The report's tab and filters live in the URL (?tab=&severity=&principle=&level=&q=&sort=) so any view can be shared. */
export function useReportFilters() {
  const [params, setParams] = useSearchParams()

  const tab = oneOf(TABS, params.get("tab")) ?? "issues"
  const filters = useMemo<IssueFilters>(
    () => ({
      severities: (params.get("severity") ?? "").split(",").filter((s): s is Severity => (SEVERITIES as readonly string[]).includes(s)),
      principle: oneOf(PRINCIPLES, params.get("principle")),
      level: oneOf(LEVELS, params.get("level")),
      q: (params.get("q") ?? "").slice(0, 100),
      sort: oneOf(["severity", "elements"] as const, params.get("sort")) ?? "severity",
    }),
    [params],
  )

  const update = useCallback(
    (patch: Partial<IssueFilters> & { tab?: ReportTab }) =>
      // Build from the CURRENT url, not the render-time `prev`: router functional updates are not queued, so two quick changes would overwrite each other
      setParams(
        () => {
          const next = new URLSearchParams(window.location.search)
          const set = (k: string, v: string | null | undefined, dflt = "") => (v && v !== dflt ? next.set(k, v) : next.delete(k))
          if ("tab" in patch) set("tab", patch.tab, "issues")
          if ("severities" in patch) set("severity", patch.severities?.join(","))
          if ("principle" in patch) set("principle", patch.principle)
          if ("level" in patch) set("level", patch.level)
          if ("q" in patch) set("q", patch.q?.trim())
          if ("sort" in patch) set("sort", patch.sort, "severity")
          return next
        },
        { replace: true }, // filtering must not fill the back button
      ),
    [setParams],
  )

  const reset = useCallback(() => update({ severities: [], principle: null, level: null, q: "", sort: "severity" }), [update])
  const active = filters.severities.length > 0 || !!filters.principle || !!filters.level || !!filters.q

  return { tab: tab as ReportTab, filters, update, reset, active }
}

export function filterRules(rules: ReportRule[], f: IssueFilters): ReportRule[] {
  const q = f.q.trim().toLowerCase()
  const out = rules.filter(
    (r) =>
      (f.severities.length === 0 || f.severities.includes(r.impact)) &&
      (!f.principle || (r.principle ?? "best-practice") === f.principle) &&
      (!f.level || r.level === f.level) &&
      (!q || `${r.help} ${r.id} ${r.description} ${r.criteria.map((c) => `${c.id} ${c.name}`).join(" ")}`.toLowerCase().includes(q)),
  )
  return out.sort((a, b) =>
    f.sort === "elements"
      ? b.totalNodes - a.totalNodes || severityRank(a.impact) - severityRank(b.impact)
      : severityRank(a.impact) - severityRank(b.impact) || b.totalNodes - a.totalNodes,
  )
}
