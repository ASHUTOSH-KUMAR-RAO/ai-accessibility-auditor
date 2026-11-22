import { Circle, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Severity = "critical" | "serious" | "moderate" | "minor"

// Colour is never the only signal: each level has its own icon shape and label.
const META: Record<Severity, { label: string; icon: LucideIcon; cls: string }> = {
  critical: { label: "Critical", icon: OctagonAlert, cls: "bg-critical-soft text-critical border-critical/40" },
  serious: { label: "Serious", icon: TriangleAlert, cls: "bg-serious-soft text-serious border-serious/40" },
  moderate: { label: "Moderate", icon: Info, cls: "bg-moderate-soft text-moderate border-moderate/40" },
  minor: { label: "Minor", icon: Circle, cls: "bg-minor-soft text-minor border-minor/40" },
}

export function SeverityBadge({ severity, count, className }: { severity: Severity; count?: number; className?: string }) {
  const { label, icon: Icon, cls } = META[severity]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", cls, className)}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
      {count !== undefined && <span className="tabular-nums opacity-90">· {count}</span>}
    </span>
  )
}
