import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, get, post, refreshAccessToken, type ApiEnvelope } from "@/lib/api"
import type { Criterion } from "@/lib/report"
import { scanBase, sourceUrl, useReportSource } from "@/lib/report-source"
import { session } from "@/lib/session"

// ───────────── Types (mirror server/src/services/ai) ─────────────
export type VerificationStatus = "VERIFIED" | "NOT_VERIFIED" | "NOT_APPLICABLE"
export type Confidence = "high" | "medium" | "low"
export type Effort = "quick" | "medium" | "large"
export type FallbackReason = "no_key" | "limited" | "rate_limited" | "failed" | null
export interface RateLimit { limit: number; resetAt: string | null }

export interface ContrastSuggestion { kind: "foreground" | "background"; color: string; ratio: number; aa: boolean; aaa: boolean }
export interface ContrastInfo {
  foreground: string
  background: string
  ratio: number
  required: number
  largeText: boolean
  aa: boolean
  aaa: boolean
  suggestions: ContrastSuggestion[]
}

export interface FixContent {
  explanation: string
  fixedHtml: string | null
  cssFix: string | null
  jsx: string | null
  steps: string[]
  test: Array<{ method: "keyboard" | "screen-reader" | "contrast" | "visual"; text: string }>
  wcag: string[]
  confidence: Confidence
  effort: Effort
}

export interface AiFix {
  id: string
  source: "ai" | "guided"
  model: string | null
  cached: boolean
  fallbackReason: FallbackReason
  rateLimit: RateLimit | null
  /** Cleaned snippet the fix was written against */
  original: string
  content: FixContent
  criteria: Criterion[]
  verification: { status: VerificationStatus; note: string }
  contrast: ContrastInfo | null
  createdAt: string
}

export interface AiSummary {
  summary: {
    verdict: string
    priorities: Array<{ ruleId: string | null; title: string; why: string; effort: Effort }>
    quickWins: string[]
    mostAffected: string
  }
  source: "ai" | "guided"
  model: string | null
  cached: boolean
  fallbackReason: FallbackReason
  rateLimit: RateLimit | null
  createdAt: string
}

export interface AiStatus {
  configured: boolean
  limited: boolean
  models: { fast: string; smart: string }
  budget: { limit: number; used: number; remaining: number; resetAt: string | null }
}

export const ak = {
  status: ["ai", "status"] as const,
  fix: (issueId: string) => ["ai", "fix", issueId] as const,
  summary: (scanId: string) => ["ai", "summary", scanId] as const,
}

/** Is the AI in a degraded mode right now? Drives the "AI is limited right now" hint. */
export const isDegraded = (s: AiStatus | undefined) => !!s && (!s.configured || s.limited)

export const useAiStatus = () => useQuery({ queryKey: ak.status, queryFn: () => get<AiStatus>("/ai/status"), staleTime: 30_000, retry: false })

// ───────────── Streaming fix ─────────────
export class AiRequestError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

interface StreamHandlers { signal: AbortSignal; onStatus: () => void; onDelta: (text: string) => void }

async function openStream(url: string, signal: AbortSignal, retried = false): Promise<Response> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? "/api"}${url}`, {
    method: "POST",
    signal,
    credentials: "include",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json", Authorization: `Bearer ${session.getToken() ?? ""}` },
    body: "{}",
  })
  if (res.status === 401 && !retried && session.hasSession()) {
    await refreshAccessToken()
    return openStream(url, signal, true)
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope | null
    throw new ApiError(body?.message ?? "The AI fix could not be created.", res.status, body?.error?.code ?? "SERVER_ERROR", body?.error?.details)
  }
  return res
}

/** POST …/ai-fix as an event stream: `status`, `delta` (explanation text as it is written), then `result` or `error`. */
export async function streamFix(scanId: string, issueId: string, h: StreamHandlers): Promise<AiFix> {
  let res: Response
  try {
    res = await openStream(`/scans/${scanId}/issues/${issueId}/ai-fix`, h.signal)
  } catch (err) {
    if (err instanceof ApiError || (err as Error).name === "AbortError") throw err
    throw new ApiError("Can't reach the server. Check your connection and try again.", null, "NETWORK")
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: AiFix | null = null
  for (;;) {
    const { done, value } = await reader.read().catch((e: unknown) => {
      if ((e as Error).name === "AbortError") throw e
      throw new ApiError("The connection dropped while the fix was being written.", null, "NETWORK")
    })
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end: number
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const event = /^event: (.+)$/m.exec(raw)?.[1]
      const data = /^data: (.+)$/m.exec(raw)?.[1]
      if (!event || !data) continue
      const payload = JSON.parse(data)
      if (event === "status") h.onStatus()
      else if (event === "delta") h.onDelta(payload.text as string)
      else if (event === "result") result = payload as AiFix
      else if (event === "error") throw new AiRequestError(payload.message as string, payload.code as string)
    }
  }
  if (!result) throw new ApiError("The fix ended unexpectedly. Please try again.", null, "INCOMPLETE")
  return result
}

export type FixState =
  | { status: "idle" }
  | { status: "loading"; text: string; generating: boolean }
  | { status: "done"; fix: AiFix; streamed: boolean }
  | { status: "error"; message: string; code: string }
  | { status: "cancelled" }

/** One element's AI fix: streams it, remembers finished fixes (so stepping back and forth is instant) and can be cancelled. */
export function useAiFix(scanId: string, issueId: string | null) {
  const qc = useQueryClient()
  const source = useReportSource()
  const [state, setState] = useState<FixState>({ status: "idle" })
  const abort = useRef<AbortController | null>(null)

  const run = useCallback(() => {
    abort.current?.abort()
    if (!issueId) return setState({ status: "idle" })
    const cached = qc.getQueryData<AiFix>(ak.fix(issueId))
    if (cached) return setState({ status: "done", fix: cached, streamed: false })

    const ac = new AbortController()
    abort.current = ac
    let text = ""
    setState({ status: "loading", text: "", generating: false })
    if (source.readOnly) {
      // Shared report: only fixes that were already saved. Nothing is generated, nothing costs anything.
      get<{ fix: AiFix }>(sourceUrl(source, scanId, `issues/${issueId}/ai-fix`))
        .then(({ fix }) => {
          qc.setQueryData(ak.fix(issueId), fix)
          setState({ status: "done", fix, streamed: false })
        })
        .catch((err: unknown) => setState({ status: "error", message: err instanceof ApiError && err.status === 404 ? "No AI fix has been saved for this element." : "Couldn't load the saved fix.", code: err instanceof ApiError ? err.code : "UNKNOWN" }))
      return
    }
    streamFix(scanId, issueId, {
      signal: ac.signal,
      onStatus: () => setState({ status: "loading", text, generating: true }),
      onDelta: (t) => {
        text += t
        setState({ status: "loading", text, generating: true })
      },
    })
      .then((fix) => {
        qc.setQueryData(ak.fix(issueId), fix)
        void qc.invalidateQueries({ queryKey: ak.status })
        setState({ status: "done", fix, streamed: text.length > 0 })
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return
        const code = err instanceof ApiError || err instanceof AiRequestError ? err.code : "UNKNOWN"
        setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong.", code })
      })
  }, [qc, scanId, issueId, source])

  const cancel = useCallback(() => {
    abort.current?.abort()
    setState({ status: "cancelled" })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting a request for the selected element
    run()
    return () => abort.current?.abort()
  }, [run])

  return { state, run, cancel }
}

// ───────────── Feedback ─────────────
export const useFixFeedback = (fixId: string) =>
  useMutation({ mutationFn: (v: { helpful: boolean; reason?: string }) => post<null>(`/ai-fixes/${fixId}/feedback`, v) })

// ───────────── Summary ─────────────
export function useAiSummary(scanId: string) {
  const qc = useQueryClient()
  const source = useReportSource()
  const base = scanBase(source, scanId)
  const stored = useQuery({
    queryKey: [...ak.summary(scanId), base],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => (await get<{ summary: AiSummary | null }>(sourceUrl(source, scanId, "ai-summary"))).summary,
  })
  const generate = useMutation({
    mutationFn: async (regenerate: boolean) => (await post<{ summary: AiSummary }>(`/scans/${scanId}/ai-summary`, { regenerate })).summary,
    onSuccess: (summary) => {
      qc.setQueryData([...ak.summary(scanId), base], summary)
      void qc.invalidateQueries({ queryKey: ak.status })
    },
  })
  return { stored, generate }
}

export function minutesUntil(iso: string | null, now = Date.now()) {
  return iso ? Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60_000)) : null
}
