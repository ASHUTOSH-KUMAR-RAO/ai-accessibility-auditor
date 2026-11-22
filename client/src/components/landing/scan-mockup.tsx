import { useState } from "react"
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion"
import { Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"
import { useEffect } from "react"
import { useMotionScale } from "@/lib/motion"

interface Finding { n: number; at: number; icon: LucideIcon; label: string; x: string; y: string; w: string; h: string; color: string }

/** Markers pop up when the scan line passes them (`at` = share of the loop). Severity = colour + icon + word, as in the real report. */
const FINDINGS: Finding[] = [
  { n: 1, at: 0.14, icon: OctagonAlert, label: "Image has no alt text", x: "6%", y: "17%", w: "20%", h: "14%", color: "var(--sev-critical)" },
  { n: 2, at: 0.3, icon: TriangleAlert, label: "Text contrast too low", x: "32%", y: "21%", w: "58%", h: "8%", color: "var(--sev-serious)" },
  { n: 3, at: 0.46, icon: OctagonAlert, label: "Button has no name", x: "32%", y: "49%", w: "17%", h: "10%", color: "var(--sev-critical)" },
  { n: 4, at: 0.62, icon: TriangleAlert, label: "Field has no label", x: "6%", y: "66%", w: "52%", h: "9%", color: "var(--sev-serious)" },
  { n: 5, at: 0.78, icon: Info, label: "Missing landmark", x: "64%", y: "62%", w: "28%", h: "20%", color: "var(--sev-moderate)" },
]

function Marker({ f, t }: { f: Finding; t: MotionValue<number> }) {
  const opacity = useTransform(t, [f.at - 0.02, f.at + 0.04, 0.92, 1], [0, 1, 1, 0])
  const scale = useTransform(t, [f.at - 0.02, f.at + 0.03, f.at + 0.07], [0.4, 1.18, 1])
  const Icon = f.icon
  return (
    <motion.div style={{ opacity, left: f.x, top: f.y, width: f.w, height: f.h, borderColor: f.color }} className="absolute rounded-md border-[3px]">
      <motion.span
        style={{ scale, borderColor: f.color }}
        className="absolute -top-3.5 left-1 inline-flex origin-bottom-left items-center gap-1 rounded-md border-2 bg-card px-1.5 text-xs font-bold leading-5 text-foreground shadow-soft"
      >
        <Icon className="size-3" style={{ color: f.color }} aria-hidden="true" />{f.n}
      </motion.span>
    </motion.div>
  )
}

/** A page being audited, on a loop: a scan line sweeps down, issues pop up, the score settles. Purely decorative. */
export function ScanMockup() {
  const { speed, distance } = useMotionScale()
  const t = useMotionValue(0)
  const [score, setScore] = useState(100)
  const [found, setFound] = useState(0)

  useEffect(() => {
    const c = animate(t, 1, { duration: 7 * speed, ease: "linear", repeat: Infinity, repeatDelay: 1.6 * speed })
    return () => c.stop()
  }, [t, speed])

  // translateY in percent of the band's own height (= the page area): moves on the compositor, no layout per frame
  const bandY = useTransform(t, [0, 0.9], ["-100%", "0%"])
  const lineOpacity = useTransform(t, [0, 0.03, 0.88, 0.93], [0, 1, 1, 0])
  useMotionValueEvent(t, "change", (v) => {
    const n = FINDINGS.filter((f) => v >= f.at + 0.02).length
    setFound((p) => (p === n ? p : n))
    const s = Math.round(100 - (100 - 62) * Math.min(1, Math.max(0, (v - 0.1) / 0.72)))
    setScore((p) => (p === s ? p : s))
  })

  return (
    <figure className="relative mx-auto w-full max-w-xl">
      <figcaption className="sr-only">Illustration: a web page is scanned from top to bottom. Five accessibility problems appear one by one, and the score settles at 62 out of 100.</figcaption>
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, -8 * distance, 0] }} transition={{ duration: 7 * speed, repeat: Infinity, ease: "easeInOut" }}
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
      >
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/70 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-foreground/25" /><span className="size-2.5 rounded-full bg-foreground/25" /><span className="size-2.5 rounded-full bg-foreground/25" />
          <span className="ml-3 flex-1 truncate rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground">https://your-site.com</span>
        </div>

        {/* the page being scanned */}
        <div className="relative aspect-[5/4] overflow-hidden bg-background/60 p-5">
          <div className="flex items-center justify-between"><span className="h-3 w-16 rounded bg-foreground/70" /><span className="flex gap-2"><span className="h-2 w-8 rounded bg-foreground/25" /><span className="h-2 w-8 rounded bg-foreground/25" /><span className="h-2 w-8 rounded bg-foreground/25" /></span></div>
          <div className="mt-5 grid grid-cols-[28%_1fr] gap-4">
            <div className="grid h-16 place-items-center rounded-lg bg-gradient-to-br from-foreground/20 to-foreground/5"><span className="size-6 rounded-full bg-foreground/30" /></div>
            <div className="space-y-2 pt-1"><span className="block h-3.5 w-11/12 rounded bg-foreground/15" /><span className="block h-3.5 w-3/4 rounded bg-foreground/10" /></div>
          </div>
          <div className="mt-6 flex gap-4"><span className="ml-[28%] h-9 w-24 rounded-lg bg-foreground/15" /></div>
          <div className="mt-9 grid grid-cols-[1fr_28%] gap-4">
            <div className="space-y-2.5"><span className="block h-9 w-full rounded-lg border-2 border-foreground/20" /><span className="block h-2.5 w-2/3 rounded bg-foreground/10" /></div>
            <div className="h-20 rounded-lg bg-foreground/[0.07]" />
          </div>

          {FINDINGS.map((f) => <Marker key={f.n} f={f} t={t} />)}

          <motion.div style={{ y: bandY, opacity: lineOpacity }} className="pointer-events-none absolute inset-0 z-10 border-b-2 border-primary bg-gradient-to-b from-transparent via-transparent to-primary/15" />
        </div>
      </motion.div>

      {/* score chip */}
      <div aria-hidden="true" className="absolute -bottom-5 -right-2 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lift sm:-right-6">
        <span className="font-display text-4xl font-semibold tabular-nums leading-none">{score}</span>
        <span className="text-sm leading-tight"><span className="block font-semibold">Accessibility score</span><span className="text-muted-foreground">{found} {found === 1 ? "issue" : "issues"} found</span></span>
      </div>
    </figure>
  )
}
