import { useEffect, useRef } from "react"
import gsap from "gsap"
import { useMotionScale } from "@/lib/motion"

const R = 52
const C = 2 * Math.PI * R

/** Animated 0–100 ring (GSAP count-up). The number is real text; the ring is decorative. */
export function ScoreRing({ score }: { score: number }) {
  const arc = useRef<SVGCircleElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const { speed } = useMotionScale()

  useEffect(() => {
    const state = { n: 0 }
    const tween = gsap.to(state, {
      n: score, duration: 1.4 * speed, ease: "power3.out", delay: 0.2,
      onUpdate: () => {
        if (num.current) num.current.textContent = String(Math.round(state.n))
        arc.current?.setAttribute("stroke-dashoffset", String(C * (1 - state.n / 100)))
      },
    })
    return () => void tween.kill()
  }, [score, speed])

  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-border" />
        <circle ref={arc} cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} className="stroke-amber-600 dark:stroke-amber-500" />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="sr-only">Score {score} out of 100</span>
        <span ref={num} aria-hidden="true" className="font-display text-5xl font-semibold tabular-nums leading-none">0</span>
        <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">out of 100</span>
      </div>
    </div>
  )
}
