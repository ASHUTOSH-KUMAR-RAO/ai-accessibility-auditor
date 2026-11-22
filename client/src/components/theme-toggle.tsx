import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useTheme, type Theme } from "@/lib/theme-store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

/** Three-way segmented control exposed to assistive tech as a radio group. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("inline-flex rounded-xl border border-border bg-card/80 p-1 shadow-soft", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <Tooltip key={value}>
            <TooltipTrigger
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={() => setTheme(value)}
              className={cn(
                "grid size-9 cursor-pointer sm:size-10 place-items-center rounded-lg transition-colors duration-200 outline-none focus-visible:outline-3 focus-visible:outline-offset-2",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

