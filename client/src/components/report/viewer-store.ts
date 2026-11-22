import { createContext, useContext } from "react"

/**
 * Glue between the issue list and the screenshot viewer.
 * - `showOnPage(id)`: list → viewer (zoom to the element and pulse it; opens the sheet on mobile)
 * - `selectFromMarker(id)`: viewer → list (open the rule, scroll to and focus the element's row)
 * Nonces re-trigger the effect even when the same element is chosen twice.
 */
export interface ViewerContextValue {
  selectedId: string | null
  showNonce: number
  listNonce: number
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  showOnPage: (id: string) => void
  selectFromMarker: (id: string) => void
}

export const ViewerContext = createContext<ViewerContextValue | null>(null)

export function useViewer() {
  const ctx = useContext(ViewerContext)
  if (!ctx) throw new Error("useViewer must be used inside <ViewerProvider>")
  return ctx
}
