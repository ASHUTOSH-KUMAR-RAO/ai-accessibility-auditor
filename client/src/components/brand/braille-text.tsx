import { useEffect, useRef } from "react"
import gsap from "gsap"
import { useMotionScale } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Standard English Braille (grade 1) — dot numbers per letter.
const DOTS: Record<string, string> = {
  a: "1", b: "12", c: "14", d: "145", e: "15", f: "124", g: "1245", h: "125", i: "24", j: "245",
  k: "13", l: "123", m: "134", n: "1345", o: "135", p: "1234", q: "12345", r: "1235", s: "234",
  t: "2345", u: "136", v: "1236", w: "2456", x: "1346", y: "13456", z: "1356",
}

/** Renders text as real Braille cells; raised dots pop in with a GSAP stagger, then breathe. */
export function BrailleText({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLSpanElement>(null)
  const { distance, speed } = useMotionScale()

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".braille-dot-on", {
        scale: 0, transformOrigin: "50% 50%", opacity: 0,
        duration: 0.5 * speed, ease: "back.out(2.4)", stagger: { each: 0.045 * speed, from: "start" }, delay: 0.3,
      })
      gsap.to(".braille-dot-on", {
        scale: 1 + 0.18 * distance, transformOrigin: "50% 50%", duration: 1.6 * speed, ease: "sine.inOut",
        yoyo: true, repeat: -1, stagger: { each: 0.12, from: "random" }, delay: 1.5,
      })
    }, root)
    return () => ctx.revert()
  }, [distance, speed, text])

  return (
    <span ref={root} role="img" aria-label={`"${text}" in Braille`} className={cn("inline-flex items-center gap-3", className)}>
      {[...text.toLowerCase()].map((ch, i) => {
        const raised = DOTS[ch] ?? ""
        return (
          <svg key={i} viewBox="0 0 20 30" aria-hidden="true" className="h-9 w-6 overflow-visible">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const on = raised.includes(String(n))
              return (
                <circle
                  key={n}
                  cx={n > 3 ? 14 : 6}
                  cy={4 + ((n - 1) % 3) * 11}
                  r="3.1"
                  className={on ? "braille-dot-on fill-primary" : "fill-foreground opacity-[0.14]"}
                />
              )
            })}
          </svg>
        )
      })}
    </span>
  )
}
