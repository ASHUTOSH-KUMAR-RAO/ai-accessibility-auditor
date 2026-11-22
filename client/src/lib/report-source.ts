import { createContext, use } from "react"

/**
 * Where a report's data comes from.
 * - the owner's own scan: /scans/:id/*
 * - a share link: /public/:token/* (read-only)
 * - the built-in sample: static JSON files under /demo (read-only, no server involved)
 */
export interface ReportSource {
  /** null = the owner's own scan: derived from the scan id */
  base: string | null
  readOnly: boolean
  /** true = `base` points at static files (see staticUrl) instead of the API */
  static?: boolean
}

export const ReportSourceCtx = createContext<ReportSource>({ base: null, readOnly: false })
export const useReportSource = () => use(ReportSourceCtx)
export const scanBase = (s: ReportSource, scanId: string) => s.base ?? `/scans/${scanId}`

/** Static layout: report.json, rules/<id>.json, fixes/<issueId>.json, keyboard.json, ai-summary.json, screenshot.webp */
function staticUrl(base: string, path: string): string {
  const p = path.split("?")[0]!
  let m: RegExpExecArray | null
  if ((m = /^rules\/([^/]+)\/nodes$/.exec(p))) return `${base}/rules/${m[1]}.json`
  if ((m = /^issues\/([^/]+)\/ai-fix$/.exec(p))) return `${base}/fixes/${m[1]}.json`
  if (p === "screenshot") return `${base}/screenshot.webp`
  return `${base}/${p}.json` // keyboard, ai-summary, report
}

/** URL of one resource of the current report, whichever source it comes from. `path` is e.g. "rules/image-alt/nodes?limit=50". */
export function sourceUrl(s: ReportSource, scanId: string, path: string): string {
  const base = scanBase(s, scanId)
  // absolute for static files: relative URLs would be prefixed with the API base by the HTTP client
  return s.static ? new URL(staticUrl(base, path), window.location.origin).href : `${base}/${path}`
}
