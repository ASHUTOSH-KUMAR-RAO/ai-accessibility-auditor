import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, ApiError, get, post, type ApiEnvelope } from "@/lib/api"
import { sourceUrl, useReportSource } from "@/lib/report-source"
import { useSocketConnected } from "@/lib/socket"

export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
export type Viewport = "DESKTOP" | "MOBILE"

export interface Scan {
  id: string
  url: string
  normalizedUrl: string
  finalUrl: string | null
  status: ScanStatus
  progress: number
  stage: string | null
  score: number | null
  criticalCount: number
  seriousCount: number
  moderateCount: number
  minorCount: number
  passesCount: number
  incompleteCount: number
  pageTitle: string | null
  viewport: Viewport
  durationMs: number | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  hasScreenshot: boolean
}

/** Live progress events carry only these fields. */
export type ScanProgress = Pick<Scan, "id" | "status" | "progress" | "stage">

export interface ScanPage { items: Scan[]; nextCursor: string | null }

/** Order matters: the server reports the current stage by this exact text. */
export const STAGES = ["Checking URL", "Loading page", "Running accessibility checks", "Capturing screenshot", "Calculating score"] as const

export const scoreLabel = (score: number) => (score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Poor")

/** Same thresholds as the server's report grade (server/src/services/report/grade.ts). */
export const gradeFor = (score: number) => (score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F")

export const isActive = (s: ScanStatus) => s === "QUEUED" || s === "RUNNING"

export const qk = {
  scan: (id: string) => ["scan", id] as const,
  screenshot: (id: string) => ["scan", id, "screenshot"] as const,
  recent: ["scans", "recent"] as const,
}

// ───────────── Friendly copy per server error code ─────────────
export const ERROR_COPY: Record<string, { title: string; hint: string }> = {
  INVALID_URL: { title: "That address doesn't look right", hint: "Use a full web address like https://example.com — no spaces, passwords or file links." },
  BLOCKED_HOST: { title: "We can only scan public websites", hint: "Localhost, private networks and unusual ports can't be scanned. Try the public address of your site." },
  DNS_FAILED: { title: "We couldn't find that website", hint: "Check the spelling of the address, then try again." },
  TIMEOUT: { title: "The scan took too long", hint: "The page may be very slow or very heavy. Try again, or scan a lighter page." },
  SITE_UNREACHABLE: { title: "We couldn't reach that website", hint: "It may be down or may block automated visitors. Try again in a minute." },
  PAGE_TOO_LARGE: { title: "That page is too large to scan", hint: "Try a lighter page on the same site." },
  SCAN_FAILED: { title: "Something went wrong", hint: "This one is on us. Please try again." },
  TOO_MANY_ACTIVE: { title: "You already have scans running", hint: "Wait for one to finish, or cancel it, then start a new scan." },
  RATE_LIMITED: { title: "Scan limit reached", hint: "You can run a limited number of scans per hour. Please try again a little later." },
}
export const errorCopy = (code: string | null) => ERROR_COPY[code ?? ""] ?? ERROR_COPY.SCAN_FAILED!

// ───────────── Requests ─────────────
export const createScan = (input: { url: string; viewport: Viewport }) => post<{ scan: Scan }>("/scans", input).then((r) => r.scan)
export const fetchScan = (id: string) => get<{ scan: Scan }>(`/scans/${id}`).then((r) => r.scan)
export const fetchRecent = () => get<ScanPage>("/scans?limit=8")
export const cancelScanRequest = (id: string) => post<{ scan: Scan }>(`/scans/${id}/cancel`).then((r) => r.scan)

// ───────────── Hooks ─────────────
const noRetry404 = (count: number, err: unknown) => !(err instanceof ApiError && (err.status === 404 || err.status === 400)) && count < 2

/** One scan. Live over the socket; falls back to polling when the socket is down. */
export function useScan(id: string) {
  const connected = useSocketConnected()
  return useQuery({
    queryKey: qk.scan(id),
    queryFn: () => fetchScan(id),
    retry: noRetry404,
    // Connected: events drive updates, a slow poll is only a safety net. Disconnected: poll quickly.
    refetchInterval: (q) => (q.state.data && isActive(q.state.data.status) ? (connected ? 20_000 : 3_000) : false),
  })
}

export function useRecentScans() {
  const connected = useSocketConnected()
  return useQuery({
    queryKey: qk.recent,
    queryFn: fetchRecent,
    refetchInterval: (q) => (q.state.data?.items.some((s) => isActive(s.status)) ? (connected ? 30_000 : 4_000) : false),
  })
}

export function useCreateScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createScan,
    onSuccess: (scan) => {
      qc.setQueryData(qk.scan(scan.id), scan)
      void qc.invalidateQueries({ queryKey: qk.recent })
    },
  })
}

export function useCancelScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelScanRequest,
    onSuccess: (scan) => {
      qc.setQueryData(qk.scan(scan.id), scan)
      void qc.invalidateQueries({ queryKey: qk.recent })
    },
  })
}

/** The screenshot endpoint needs the bearer token, so an <img src> can't call it: fetch as a blob instead. */
export function useScreenshotBlob(id: string, enabled: boolean) {
  const source = useReportSource()
  const url = sourceUrl(source, id, "screenshot")
  return useQuery({
    queryKey: [...qk.screenshot(id), url],
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => (await api.get<Blob>(url, { responseType: "blob" })).data,
  })
}

export type { ApiEnvelope }
