import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError, get, post } from "@/lib/api"
import { scanBase, useReportSource } from "@/lib/report-source"
import type { Severity } from "@/lib/severity"

// ───────────── Keyboard tab order (mirror server/src/services/scanner/tab-order.ts) ─────────────
export interface Box { x: number; y: number; width: number; height: number }
export interface TabStop { n: number; selector: string; tag: string; role: string; name: string; box: Box; focusVisible: boolean; focusLost?: boolean; offscreen: boolean }
export type TabWarningType = "focus-jump" | "invisible-focus" | "focus-lost" | "offscreen" | "trap" | "unreachable"
export interface TabWarning { type: TabWarningType; stop?: number; message: string }
export interface Unreachable { selector: string; tag: string; role: string; name: string; box: Box }
export interface TabOrder {
  stops: TabStop[]
  complete: boolean
  truncated: boolean
  trap: { stop: number; selector: string } | null
  unreachable: Unreachable[]
  page: { width: number; height: number; viewportHeight: number }
  warnings: TabWarning[]
}

export function useKeyboard(scanId: string) {
  const base = scanBase(useReportSource(), scanId)
  return useQuery({
    queryKey: ["scan", scanId, "keyboard", base],
    staleTime: Infinity,
    queryFn: () => get<{ available: boolean; tabOrder: TabOrder | null }>(`${base}/keyboard`),
  })
}

// ───────────── Share links ─────────────
export interface Share { id: string; expiresAt: string | null; hideScreenshot: boolean; views: number; lastViewedAt: string | null; createdAt: string }
export interface CreatedShare { share: Share; token: string; path: string; badgePath: string }
export type Expiry = "24h" | "7d" | "30d" | "never"
export const EXPIRY_LABEL: Record<Expiry, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", never: "Never" }

const sharesKey = (scanId: string) => ["scan", scanId, "shares"] as const

export const useShares = (scanId: string, enabled: boolean) =>
  useQuery({ queryKey: sharesKey(scanId), enabled, queryFn: async () => (await get<{ shares: Share[] }>(`/scans/${scanId}/shares`)).shares })

export function useCreateShare(scanId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { expiry: Expiry; hideScreenshot: boolean }) => post<CreatedShare>(`/scans/${scanId}/shares`, v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sharesKey(scanId) }),
  })
}

export function useRevokeShare(scanId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) => api.delete(`/scans/${scanId}/shares/${shareId}`).then(() => shareId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sharesKey(scanId) }),
  })
}

/** Absolute URL for a path served by this site (works with the Vite proxy and a production rewrite). */
export const siteUrl = (path: string) => new URL(path, window.location.origin).href
/** The API origin as the browser sees it: used for the embeddable badge. */
export const apiUrl = (path: string) => new URL(`${(import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "")}${path}`, window.location.origin).href

// ───────────── Compare + sites ─────────────
export interface IssueRef { id: string; ruleId: string; impact: Severity; help: string; selector: string; html: string }
export type RuleStatus = "fixed" | "new" | "improved" | "worse" | "unchanged"
export interface ScanSummary { id: string; url: string; viewport: "DESKTOP" | "MOBILE"; createdAt: string; score: number; counts: Record<Severity, number> }
export interface Comparison {
  host: string
  before: ScanSummary
  after: ScanSummary
  scoreDelta: number
  totals: { fixed: number; new: number; unchanged: number }
  sampled: boolean
  rules: Array<{ ruleId: string; help: string; impact: Severity; status: RuleStatus; before: number; after: number }>
  fixed: IssueRef[]
  new: IssueRef[]
  unchanged: IssueRef[]
}

export const useCompare = (a: string, b: string) =>
  useQuery({
    queryKey: ["compare", a, b],
    enabled: !!a && !!b,
    staleTime: Infinity,
    retry: (n, err) => !(err instanceof ApiError && err.status && err.status < 500) && n < 2,
    queryFn: () => get<Comparison>(`/compare?a=${a}&b=${b}`),
  })

export interface SiteSummary { host: string; scanCount: number; latest: { id: string; score: number; createdAt: string; viewport: "DESKTOP" | "MOBILE" }; previousScore: number | null; favicon: string | null }
export const useSites = () => useQuery({ queryKey: ["sites"], queryFn: async () => (await get<{ sites: SiteSummary[] }>("/sites")).sites })

export interface SiteScan { id: string; score: number; createdAt: string; viewport: "DESKTOP" | "MOBILE"; url: string; criticalCount: number; seriousCount: number; moderateCount: number; minorCount: number }
export interface Site { host: string; favicon: string | null; scans: SiteScan[]; latest: SiteScan; previous: { id: string } | null }
export const useSite = (host: string) =>
  useQuery({
    queryKey: ["sites", host],
    queryFn: () => get<Site>(`/sites/${encodeURIComponent(host)}`),
    retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 2,
  })

// ───────────── Downloads (the API needs the bearer token, so a plain link can't be used) ─────────────
export async function downloadFile(path: string, fallbackName: string) {
  const res = await api.get<Blob>(path, { responseType: "blob", timeout: 90_000 })
  const name = /filename="([^"]+)"/.exec(String(res.headers["content-disposition"] ?? ""))?.[1] ?? fallbackName
  const url = URL.createObjectURL(res.data)
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
