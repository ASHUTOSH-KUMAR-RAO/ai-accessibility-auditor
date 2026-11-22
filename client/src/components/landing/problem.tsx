import { useEffect, useRef, useState } from "react"
import { animate, useInView } from "framer-motion"
import { useMotionScale } from "@/lib/motion"
import { Reveal } from "./reveal"

/** Counts up when scrolled into view. Reduced motion: same count-up, a bit slower. Screen readers get the final value at once. */
function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" })
  const { speed } = useMotionScale()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 1.6 * speed, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) })
    return () => c.stop()
  }, [inView, to, speed])
  const fmt = (n: number) => n.toFixed(decimals)
  return (
    <span ref={ref}>
      <span aria-hidden="true">{fmt(v)}{suffix}</span>
      <span className="sr-only">{fmt(to)}{suffix}</span>
    </span>
  )
}

interface Fact { value: number; decimals?: number; suffix: string; text: string; source: string; href: string }
// Every number below is quoted from the named source. Nothing is estimated or rounded up.
const FACTS: Fact[] = [
  { value: 94.8, decimals: 1, suffix: "%", text: "of the one million most popular home pages had detectable WCAG 2 failures.", source: "WebAIM Million, 2025", href: "https://webaim.org/projects/million/" },
  { value: 79.1, decimals: 1, suffix: "%", text: "of those home pages had text with too little colour contrast, the most common failure.", source: "WebAIM Million, 2025", href: "https://webaim.org/projects/million/" },
  { value: 1.3, decimals: 1, suffix: " billion", text: "people, about 1 in 6 worldwide, live with a significant disability.", source: "World Health Organization", href: "https://www.who.int/news-room/fact-sheets/detail/disability-and-health" },
  { value: 2.2, decimals: 1, suffix: " billion", text: "people have some form of vision impairment, near or distance.", source: "WHO World report on vision, 2019", href: "https://www.who.int/publications/i/item/9789241516570" },
]

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="container-page py-8 sm:py-12">
      <Reveal className="max-w-3xl">
        <p className="eyebrow">The problem</p>
        <h2 id="problem-title" className="mt-3 text-4xl font-semibold sm:text-5xl">Most of the web still locks people out.</h2>
        <p className="mt-4 text-lg text-muted-foreground">Accessibility is not an edge case. It decides whether a visitor can read, click, buy or sign up at all, and most sites still get the basics wrong.</p>
      </Reveal>
      <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((f, i) => (
          <Reveal as="li" key={f.text} delay={i * 0.1}>
            <p className="font-display text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl"><CountUp to={f.value} decimals={f.decimals} suffix={f.suffix} /></p>
            <p className="mt-3 text-lg">{f.text}</p>
            <p className="mt-2 text-sm text-muted-foreground">Source: <a href={f.href} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-4">{f.source}<span className="sr-only"> (opens in a new tab)</span></a></p>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}
