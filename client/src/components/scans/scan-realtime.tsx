import { useEffect } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useAuth } from "@/context/auth-store"
import { rk } from "@/lib/report"
import { qk, type Scan, type ScanPage, type ScanProgress } from "@/lib/scans"
import { connectScanSocket, disconnectScanSocket } from "@/lib/socket"

/** Merge a (possibly partial) scan update into the single-scan cache and the recent list. */
function applyUpdate(qc: QueryClient, update: Partial<Scan> & { id: string }, isNew = false) {
  qc.setQueryData<Scan>(qk.scan(update.id), (old) => (old ? { ...old, ...update } : isNew ? (update as Scan) : old))
  qc.setQueryData<ScanPage>(qk.recent, (old) => {
    if (!old) return old
    const exists = old.items.some((s) => s.id === update.id)
    if (exists) return { ...old, items: old.items.map((s) => (s.id === update.id ? { ...s, ...update } : s)) }
    return isNew ? { ...old, items: [update as Scan, ...old.items].slice(0, 8) } : old
  })
}

/** Mounted once for signed-in users: one socket, keeps every scan view live (any tab, any page). */
export function ScanRealtime() {
  const { status } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (status !== "authenticated") return
    const socket = connectScanSocket(() => {
      void qc.invalidateQueries({ queryKey: ["scan"] })
      void qc.invalidateQueries({ queryKey: ["scans"] })
    })
    // Anything that changes what history / stats show: refetch those (cheap, and filters are applied server-side)
    const refreshLists = () => {
      void qc.invalidateQueries({ queryKey: ["history"] })
      void qc.invalidateQueries({ queryKey: rk.stats })
    }
    socket.on("scan:queued", (scan: Scan) => { applyUpdate(qc, scan, true); refreshLists() })
    socket.on("scan:progress", (p: ScanProgress) => applyUpdate(qc, p))
    for (const event of ["scan:completed", "scan:failed", "scan:cancelled"]) socket.on(event, (scan: Scan) => { applyUpdate(qc, scan, true); refreshLists() })
    // deleted in another tab/device: drop it here too
    socket.on("scan:deleted", ({ id }: { id: string }) => {
      qc.removeQueries({ queryKey: qk.scan(id) })
      qc.setQueryData<ScanPage>(qk.recent, (old) => (old ? { ...old, items: old.items.filter((s) => s.id !== id) } : old))
      refreshLists()
    })
    return disconnectScanSocket
  }, [status, qc])

  return null
}
