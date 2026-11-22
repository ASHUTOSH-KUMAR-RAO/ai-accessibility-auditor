import { useState } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "./reveal"

const STACK = ["React", "TypeScript", "Node.js", "Express", "Playwright", "axe-core", "PostgreSQL", "Prisma", "Socket.io", "Groq", "Tailwind CSS", "Framer Motion"]

/** Moves left to right, endlessly. Pauses on hover and focus, plus a real pause button (WCAG 2.2.2). Slower, never stopped, for reduced motion. */
export function Marquee() {
  const [paused, setPaused] = useState(false)
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-4 pr-4">
      {STACK.map((t) => <li key={t} className="rounded-full border border-border bg-card/90 px-6 py-3 font-display text-xl font-semibold whitespace-nowrap shadow-soft">{t}</li>)}
    </ul>
  )
  return (
    <section aria-labelledby="stack-title" className="py-8 sm:py-10">
      <Reveal className="container-page flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Built with</p>
          <h2 id="stack-title" className="mt-3 text-3xl font-semibold sm:text-4xl">Honest, boring, battle-tested tech.</h2>
        </div>
        <Button variant="outline" size="sm" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{paused ? "Play" : "Pause"}<span className="sr-only"> the scrolling list</span>
        </Button>
      </Reveal>
      <div className="marquee mt-8" data-paused={paused || undefined} style={{ maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)" }}>
        <div className="marquee-track flex w-max">{row(false)}{row(true)}</div>
      </div>
    </section>
  )
}
