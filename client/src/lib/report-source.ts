import { createContext, use } from "react"

/**
 * Where a report's data comes from. The owner's report talks to /scans/:id/*. A shared report talks to
 * /public/:token/* and is read-only: no generating, no re-scanning, no feedback.
 */
export interface ReportSource {
  /** null = the owner's own scan: derived from the scan id */
  base: string | null
  readOnly: boolean
}

export const ReportSourceCtx = createContext<ReportSource>({ base: null, readOnly: false })
export const useReportSource = () => use(ReportSourceCtx)
export const scanBase = (s: ReportSource, scanId: string) => s.base ?? `/scans/${scanId}`
