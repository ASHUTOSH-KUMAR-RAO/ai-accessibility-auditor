import { SEVERITY, type Severity } from "@/lib/severity"
import { cn } from "@/lib/utils"

export type { Severity }

/** Icon + word + tinted outline. Text stays in ink; the severity colour lives in the icon and border. */
export function SeverityBadge({ severity, count, className }: { severity: Severity; count?: number; className?: string }) {
  const { label, icon: Icon, chip, iconClass } = SEVERITY[severity]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold text-foreground", chip, className)}>
      <Icon className={cn("size-4 shrink-0", iconClass)} aria-hidden="true" />
      {label}
      {count !== undefined && <span className="tabular-nums">· {count}</span>}
    </span>
  )
}
