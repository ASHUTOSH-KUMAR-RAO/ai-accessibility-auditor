import { useEffect, useRef } from "react"
import gsap from "gsap"
import { motion } from "framer-motion"
import { SeverityBadge, type Severity } from "@/components/brand/severity-badge"
import { useMotionScale } from "@/lib/motion"

const SCORE = 72
const R = 52
const C = 2 * Math.PI * R

const ISSUES: Array<{ severity: Severity; text: string }> = [
  { severity: "critical", text: "Image is missing alternative text" },
  { severity: "serious", text: "Text contrast is 2.8:1, needs 4.5:1" },
  { severity: "moderate", text: "Link text says only “click here”" },
]

/** Illustrative sample report — static data, clearly labelled as a preview. */
export function HeroReportCard() {
  const arc = useRef<SVGCircleElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const { distance, speed } = useMotionScale()

  useEffect(() => {
    const state = { n: 0 }
    const tween = gsap.timeline({ delay: 0.7 })
    tween.to(state, {
      n: SCORE, duration: 1.6 * speed, ease: "power3.out",
      onUpdate: () => {
        if (num.current) num.current.textContent = String(Math.round(state.n))
        arc.current?.setAttribute("stroke-dashoffset", String(C * (1 - state.n / 100)))
      },
    })
    return () => { tween.kill() }
  }, [speed])

  const float = (amp: number, dur: number, delay = 0) => ({
    animate: { y: [0, -amp * distance, 0] },
    transition: { duration: dur * speed, repeat: Infinity, ease: "easeInOut" as const, delay },
  })

  return (
    <div className="relative mx-auto w-full max-w-md" role="group" aria-label="Sample accessibility report preview">
      <motion.div {...float(10, 6)} className="rounded-3xl border border-border bg-card p-6 shadow-lift">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">example-shop.com</span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">Sample report</span>
        </div>

        <div className="mt-5 flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-border" />
              <circle ref={arc} cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C} className="stroke-amber-600 dark:stroke-amber-500" />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <span ref={num} className="font-display text-4xl font-semibold tabular-nums leading-none">0</span>
              <span className="text-xs font-medium text-muted-foreground">out of 100</span>
            </div>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold leading-tight">Needs work</p>
            <p className="mt-1 text-sm text-muted-foreground">12 issues across 4 WCAG principles</p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {ISSUES.map((i, idx) => (
            <motion.li
              key={i.text}
              initial={{ opacity: 0, x: 16 * distance }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (0.9 + idx * 0.15) * speed, duration: 0.45 * speed }}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-muted/70 p-3"
            >
              <SeverityBadge severity={i.severity} />
              <span className="text-sm">{i.text}</span>
            </motion.li>
          ))}
        </ul>

        <pre className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-[#0f0d0a] p-4 font-mono text-[0.8rem] leading-relaxed text-[#f3ecdd]" aria-label="AI-suggested fix">
          <code>
            <span className="opacity-60">- &lt;img src="team.jpg"&gt;</span>{"\n"}
            <span className="text-amber-300">+ &lt;img src="team.jpg" alt="Our team at work"&gt;</span>
          </code>
        </pre>
      </motion.div>

      <motion.div {...float(8, 5, 0.6)} className="absolute -right-2 -top-5 hidden sm:block" aria-hidden="true">
        <SeverityBadge severity="critical" count={3} className="shadow-lift" />
      </motion.div>
      <motion.div {...float(9, 7, 1.2)} className="absolute -left-4 top-1/3 hidden sm:block lg:-left-10" aria-hidden="true">
        <SeverityBadge severity="serious" count={5} className="shadow-lift" />
      </motion.div>
      <motion.div {...float(7, 5.5, 0.3)} className="absolute -bottom-4 right-8" aria-hidden="true">
        <SeverityBadge severity="moderate" count={4} className="shadow-lift" />
      </motion.div>
    </div>
  )
}
