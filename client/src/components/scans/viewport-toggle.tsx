import { Monitor, Smartphone, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Viewport } from "@/lib/scans"

const OPTIONS: Array<{ value: Viewport; label: string; detail: string; icon: LucideIcon }> = [
  { value: "DESKTOP", label: "Desktop", detail: "1280 × 800", icon: Monitor },
  { value: "MOBILE", label: "Mobile", detail: "390 × 844", icon: Smartphone },
]

/** Segmented radio group with visible text (not icon-only). Arrow keys move between options. */
export function ViewportToggle({ value, onChange, disabled }: { value: Viewport; onChange: (v: Viewport) => void; disabled?: boolean }) {
  return (
    <div
      role="radiogroup"
      aria-label="Screen size to scan"
      className="inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-card/80 p-1 shadow-soft"
    >
      {OPTIONS.map(({ value: v, label, detail, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={v}
            disabled={disabled}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              // radio-group keyboard pattern: arrows move the selection (and focus) to the other option
              if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return
              e.preventDefault()
              const next = v === "DESKTOP" ? "MOBILE" : "DESKTOP"
              onChange(next)
              e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus()
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg px-4 py-2.5 text-left transition-colors duration-200 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="leading-tight">
              <span className="block font-semibold">{label}</span>
              <span className={cn("block text-xs", active ? "text-background/80" : "text-muted-foreground")}>{detail}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
