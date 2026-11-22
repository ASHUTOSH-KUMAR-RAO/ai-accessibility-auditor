import { motion } from "framer-motion"
import { useMotionScale } from "@/lib/motion"
import { STAGES } from "@/lib/scans"
import { cn } from "@/lib/utils"

type StepState = "done" | "active" | "pending"

/** One Braille cell per stage: ghost dots → pulsing amber dots (active) → fully raised (done). */
function Cell({ state }: { state: StepState }) {
  const { distance, speed } = useMotionScale()
  return (
    <svg viewBox="0 0 20 30" aria-hidden="true" className="h-10 w-7 shrink-0 overflow-visible">
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const cx = n > 2 ? 14 : 6
        const cy = 4 + (n % 3) * 11
        if (state === "active") {
          return (
            <motion.circle
              key={n} cx={cx} cy={cy} r="3.3" className="fill-primary"
              animate={{ scale: [0.55, 1 + 0.25 * distance, 0.55], opacity: [0.45, 1, 0.45] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              transition={{ duration: 1.3 * speed, repeat: Infinity, delay: n * 0.14, ease: "easeInOut" }}
            />
          )
        }
        return <circle key={n} cx={cx} cy={cy} r="3.1" className={state === "done" ? "fill-amber-600 dark:fill-amber-500" : "fill-foreground opacity-[0.16]"} />
      })}
    </svg>
  )
}

export function StageStepper({ current }: { current: number }) {
  return (
    <ol className="grid gap-3 md:grid-cols-5">
      {STAGES.map((label, i) => {
        const state: StepState = i < current ? "done" : i === current ? "active" : "pending"
        return (
          <li
            key={label}
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 transition-colors duration-300 md:flex-col md:items-start md:gap-2",
              state === "active" ? "border-ring bg-card shadow-soft" : "border-border bg-card/60",
            )}
          >
            <Cell state={state} />
            <div>
              <p className={cn("font-semibold leading-snug", state === "pending" && "text-muted-foreground")}>{label}</p>
              <p className="text-sm text-muted-foreground">
                <span className="sr-only">Step {i + 1} of {STAGES.length}: </span>
                {state === "done" ? "Done" : state === "active" ? "In progress" : "Waiting"}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
