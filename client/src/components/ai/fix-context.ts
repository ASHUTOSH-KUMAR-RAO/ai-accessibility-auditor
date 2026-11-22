import { createContext, use } from "react"

export interface FixContext {
  /** AI fix for one element */
  openNode: (ruleId: string, nodeId: string) => void
  /** AI fix for a rule's first element, with next / previous to walk the rest */
  openRule: (ruleId: string) => void
}

export const FixCtx = createContext<FixContext | null>(null)

export function useAiFixPanel() {
  const ctx = use(FixCtx)
  if (!ctx) throw new Error("useAiFixPanel must be used inside <AiFixProvider>")
  return ctx
}
