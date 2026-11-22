import { Minus, TrendingDown, TrendingUp } from "lucide-react"

/** Score change as icon + words + sign: never colour alone. */
export function Delta({ delta, compact = false }: { delta: number | null; compact?: boolean }) {
  if (delta === null) return <span className="text-sm text-muted-foreground">First scan</span>
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  return (
    <span className={compact ? "inline-flex items-center gap-1 text-sm font-semibold" : "inline-flex items-center gap-1 rounded-full border-2 border-border px-2.5 py-0.5 text-sm font-semibold"}>
      <Icon className="size-4" aria-hidden="true" />
      {delta > 0 ? `+${delta}${compact ? "" : " points"}` : delta < 0 ? `${delta}${compact ? "" : " points"}` : "No change"}<span className="sr-only">{delta > 0 ? ", improved" : delta < 0 ? ", got worse" : ""}</span>
    </span>
  )
}
