import { useCallback, useMemo, useState, type ReactNode } from "react"
import type { Report } from "@/lib/report"
import { FixCtx } from "./fix-context"
import { FixPanel, type FixTarget } from "./fix-panel"

export function AiFixProvider({ report, children }: { report: Report; children: ReactNode }) {
  const [target, setTarget] = useState<FixTarget | null>(null)
  const openNode = useCallback((ruleId: string, nodeId: string) => setTarget({ ruleId, nodeId }), [])
  const openRule = useCallback((ruleId: string) => setTarget({ ruleId, nodeId: null }), [])
  const value = useMemo(() => ({ openNode, openRule }), [openNode, openRule])
  return (
    <FixCtx value={value}>
      {children}
      <FixPanel report={report} target={target} onTarget={setTarget} onClose={() => setTarget(null)} />
    </FixCtx>
  )
}
