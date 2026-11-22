import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

/** Mark = one Braille cell (2×3 dots). Raised dots in amber, flat positions ghosted. */
export function LogoMark({ className }: { className?: string }) {
  const dots: Array<[number, number, boolean]> = [
    [18, 14, true], [30, 14, false],
    [18, 24, false], [30, 24, true],
    [18, 34, true], [30, 34, false],
  ]
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-9", className)}>
      <rect width="48" height="48" rx="12" className="fill-foreground" />
      {dots.map(([cx, cy, on]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" fill={on ? "#f58a0b" : "var(--background)"} opacity={on ? 1 : 0.3} />
      ))}
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="AccessLens home" className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)}>
      <LogoMark className="transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105" />
      <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl [font-variation-settings:'SOFT'_100,'WONK'_1]">
        Access<span className="italic">Lens</span>
      </span>
    </Link>
  )
}

