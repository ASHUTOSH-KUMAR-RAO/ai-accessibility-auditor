import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Brain, Eye, Hand, Keyboard, Palette, Speech, type LucideIcon } from "lucide-react"
import { api, ApiError, get, post } from "@/lib/api"
import { qk, type Scan, type ScanPage } from "@/lib/scans"
import type { Severity } from "@/lib/severity"

// ───────────── Types (mirror server/src/services/report/types.ts) ─────────────
export type Principle = "perceivable" | "operable" | "understandable" | "robust"
export type PrincipleOrOther = Principle | "best-practice"
export type RuleLevel = "A" | "AA" | "best-practice"
export type Audience = "screen-reader" | "keyboard" | "low-vision" | "color-blind" | "cognitive" | "motor"
export interface Box { x: number; y: number; width: number; height: number }
export interface Criterion { id: string; name: string; level: "A" | "AA" | "AAA"; principle: Principle; url: string }

export interface ReportRule {
  id: string
  impact: Severity
  help: string
  description: string
  helpUrl: string
  criteria: Criterion[]
  principle: Principle | null
  level: RuleLevel
  audiences: Audience[]
  totalNodes: number
  storedNodes: number
  approximate: boolean
}
export interface ReportReview {
  id: string
  impact: Severity | null
  help: string
  description: string
  helpUrl: string
  totalNodes: number
  nodes: Array<{ selector: string; html: string; message: string }>
  criteria: Criterion[]
  principle: Principle | null
  level: RuleLevel
  guidance: string
}
export interface ReportPassed { id: string; help: string; principle: Principle | null; level: RuleLevel }
export interface Marker { id: string; ruleId: string; impact: Severity; n: number; box: Box }

export interface Report {
  scan: {
    id: string; url: string; finalUrl: string | null; pageTitle: string | null; favicon: string | null
    viewport: "DESKTOP" | "MOBILE"; durationMs: number | null; createdAt: string; startedAt: string | null; completedAt: string | null
    score: number; grade: string; verdict: string
  }
  grading: Array<{ grade: string; min: number }>
  severity: Array<{ impact: Severity; rules: number; elements: number }>
  principles: Array<{ id: PrincipleOrOther; name: string; rules: number; elements: number }>
  levels: Array<{ id: RuleLevel; name: string; rules: number; elements: number }>
  rules: ReportRule[]
  review: ReportReview[]
  passed: ReportPassed[]
  counts: { issues: number; review: number; passed: number }
  screenshot: { width: number; height: number } | null
  markers: Marker[]
}

export interface RuleNode { id: string; selector: string; html: string; failureSummary: string; boundingBox: Box | null; occurrenceIndex: number }

export const AUDIENCES: Record<Audience, { label: string; icon: LucideIcon }> = {
  "screen-reader": { label: "Screen reader users", icon: Speech },
  keyboard: { label: "Keyboard users", icon: Keyboard },
  "low-vision": { label: "People with low vision", icon: Eye },
  "color-blind": { label: "People with color blindness", icon: Palette },
  cognitive: { label: "People with cognitive disabilities", icon: Brain },
  motor: { label: "People with motor disabilities", icon: Hand },
}

export const PRINCIPLE_LABEL: Record<PrincipleOrOther, string> = {
  perceivable: "Perceivable", operable: "Operable", understandable: "Understandable", robust: "Robust", "best-practice": "Best practice",
}
export const LEVEL_LABEL: Record<RuleLevel, string> = { A: "Level A", AA: "Level AA", "best-practice": "Best practice" }

// ───────────── Query keys ─────────────
export const rk = {
  report: (id: string) => ["scan", id, "report"] as const,
  nodes: (id: string, ruleId: string) => ["scan", id, "nodes", ruleId] as const,
  history: (f: HistoryFilters) => ["history", f] as const,
  stats: ["stats"] as const,
}

// ───────────── Report ─────────────
export const useReport = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: rk.report(id),
    enabled,
    staleTime: 5 * 60_000, // a finished scan never changes
    queryFn: async () => (await get<{ report: Report }>(`/scans/${id}/report`)).report,
    retry: (n, err) => !(err instanceof ApiError && err.status && err.status < 500) && n < 2,
  })

/** One rule's affected elements, loaded when its card is opened. */
export function useRuleNodes(scanId: string, ruleId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: rk.nodes(scanId, ruleId),
    enabled,
    staleTime: Infinity,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => get<{ items: RuleNode[]; nextCursor: string | null }>(`/scans/${scanId}/rules/${encodeURIComponent(ruleId)}/nodes?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

// ───────────── Actions ─────────────
export function useRescan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post<{ scan: Scan }>(`/scans/${id}/rescan`).then((r) => r.scan),
    onSuccess: (scan) => {
      qc.setQueryData(qk.scan(scan.id), scan)
      void qc.invalidateQueries({ queryKey: qk.recent })
      void qc.invalidateQueries({ queryKey: ["history"] })
      void qc.invalidateQueries({ queryKey: rk.stats })
    },
  })
}

export function useDeleteScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/scans/${id}`).then(() => id),
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: qk.scan(id) })
      void qc.invalidateQueries({ queryKey: qk.recent })
      void qc.invalidateQueries({ queryKey: ["history"] })
      void qc.invalidateQueries({ queryKey: rk.stats })
    },
  })
}

// ───────────── History ─────────────
export interface HistoryFilters {
  q: string
  status: string
  viewport: string
  minScore: string
  maxScore: string
  sort: "date" | "score"
  order: "asc" | "desc"
}
export const DEFAULT_HISTORY: HistoryFilters = { q: "", status: "", viewport: "", minScore: "", maxScore: "", sort: "date", order: "desc" }

export function useScanHistory(filters: HistoryFilters) {
  return useInfiniteQuery({
    queryKey: rk.history(filters),
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData, // keep the old list on screen while a new filter loads
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ limit: "12", sort: filters.sort, order: filters.order })
      for (const k of ["q", "status", "viewport", "minScore", "maxScore"] as const) if (filters[k]) p.set(k, filters[k])
      if (pageParam) p.set("cursor", pageParam)
      return get<ScanPage>(`/scans?${p}`)
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export interface ScanStats {
  totalScans: number
  completedScans: number
  averageScore: number | null
  mostCommonIssue: { ruleId: string; help: string; scans: number } | null
}
export const useScanStats = () => useQuery({ queryKey: rk.stats, queryFn: () => get<ScanStats>("/scans/stats") })
