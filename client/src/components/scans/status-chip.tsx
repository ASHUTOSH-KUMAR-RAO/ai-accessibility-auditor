import { CircleCheck, CircleSlash, Clock, Loader2, OctagonAlert, type LucideIcon } from "lucide-react"
import type { Scan, ScanStatus } from "@/lib/scans"
import { cn } from "@/lib/utils"

const META: Record<ScanStatus, { label: string; icon: LucideIcon; cls: string }> = {
  QUEUED: { label: "Queued", icon: Clock, cls: "bg-muted text-foreground border-border" },
  RUNNING: { label: "Scanning", icon: Loader2, cls: "bg-moderate-soft text-moderate border-moderate/40" },
  COMPLETED: { label: "Completed", icon: CircleCheck, cls: "bg-minor-soft text-minor border-minor/40" },
  FAILED: { label: "Failed", icon: OctagonAlert, cls: "bg-critical-soft text-critical border-critical/40" },
  CANCELLED: { label: "Cancelled", icon: CircleSlash, cls: "bg-muted text-muted-foreground border-border" },
}

/** Icon + word, never colour alone. */
export function StatusChip({ scan }: { scan: Pick<Scan, "status" | "progress"> }) {
  const { label, icon: Icon, cls } = META[scan.status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold", cls)}>
      <Icon className={cn("size-4", scan.status === "RUNNING" && "animate-spin")} aria-hidden="true" />
      {label}
      {scan.status === "RUNNING" && <>{" "}<span className="tabular-nums">{scan.progress}%</span></>}
    </span>
  )
}
