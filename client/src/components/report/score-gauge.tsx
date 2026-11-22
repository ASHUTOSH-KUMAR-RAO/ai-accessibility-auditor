import { useEffect, useRef } from "react"
import gsap from "gsap"
import { useMotionScale } from "@/lib/motion"

const R = 78
const C = 2 * Math.PI * R
// Where the grade boundaries sit on the ring (ticks), so the ring itself explains the letter
const TICKS = [60, 70, 80, 90]

/** 0–100 ring with a GSAP count-up, grade tick marks, and the grade letter. The number is real text; the ring is decoration. */
export function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const arc = useRef<SVGCircleElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const { speed } = useMotionScale()

  useEffect(() => {
    const state = { n: 0 }
    const tween = gsap.to(state, {
      n: score, duration: 1.6 * speed, ease: "power3.out", delay: 0.25,
      onUpdate: () => {
        if (num.current) num.current.textContent = String(Math.round(state.n))
        arc.current?.setAttribute("stroke-dashoffset", String(C * (1 - state.n / 100)))
      },
    })
    return () => void tween.kill()
  }, [score, speed])

  return (
    <div className="relative size-56 shrink-0 sm:size-64">
      <svg viewBox="0 0 200 200" className="size-full" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          <circle cx="100" cy="100" r={R} fill="none" strokeWidth="14" className="stroke-border" />
          <circle ref={arc} cx="100" cy="100" r={R} fill="none" strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} className="stroke-amber-600 dark:stroke-amber-500" />
          {TICKS.map((t) => (
            <line key={t} x1="100" y1="6" x2="100" y2="22" strokeWidth="2.5" className="stroke-foreground" transform={`rotate(${t * 3.6} 100 100)`} opacity="0.55" />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="sr-only">Score {score} out of 100, grade {grade}</span>
        <span ref={num} aria-hidden="true" className="font-display text-7xl font-semibold leading-none tabular-nums">0</span>
        <span aria-hidden="true" className="mt-1 text-sm font-medium text-muted-foreground">out of 100</span>
      </div>
      <div aria-hidden="true" className="absolute -bottom-1 left-1/2 grid size-14 -translate-x-1/2 place-content-center rounded-2xl border-2 border-foreground bg-card font-display text-4xl font-semibold shadow-lift">
        {grade}
      </div>
    </div>
  )
}
