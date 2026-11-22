import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useIsDesktop } from "@/lib/hooks"
import { ViewerContext, type ViewerContextValue } from "./viewer-store"

export function ViewerProvider({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNonce, setShowNonce] = useState(0)
  const [listNonce, setListNonce] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  const showOnPage = useCallback(
    (id: string) => {
      setSelectedId(id)
      setShowNonce((n) => n + 1)
      if (!isDesktop) setSheetOpen(true) // small screens: the viewer lives in a full-height sheet
    },
    [isDesktop],
  )
  const selectFromMarker = useCallback(
    (id: string) => {
      setSelectedId(id)
      setListNonce((n) => n + 1)
      if (!isDesktop) setSheetOpen(false) // reveal the issue the marker belongs to; "Show on page" brings the viewer back
    },
    [isDesktop],
  )

  const value = useMemo<ViewerContextValue>(
    () => ({ selectedId, showNonce, listNonce, sheetOpen, setSheetOpen, showOnPage, selectFromMarker }),
    [selectedId, showNonce, listNonce, sheetOpen, showOnPage, selectFromMarker],
  )
  return <ViewerContext value={value}>{children}</ViewerContext>
}
