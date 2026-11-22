import { motion } from "framer-motion"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useMotionScale } from "@/lib/motion"

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const STEP_BG: Record<(typeof STEPS)[number], string> = {
  50: "bg-amber-50", 100: "bg-amber-100", 200: "bg-amber-200", 300: "bg-amber-300", 400: "bg-amber-400",
  500: "bg-amber-500", 600: "bg-amber-600", 700: "bg-amber-700", 800: "bg-amber-800", 900: "bg-amber-900", 950: "bg-amber-950",
}

export function DesignSystemPreview() {
  const { distance, speed } = useMotionScale()
  const reveal = {
    initial: { opacity: 0, y: 28 * distance },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] as const },
  }

  return (
    <section aria-labelledby="ds-title" className="container-page mt-28">
      <motion.div {...reveal} className="max-w-2xl">
        <p className="eyebrow">Design system</p>
        <h2 id="ds-title" className="mt-3 text-4xl font-semibold sm:text-5xl">Paper, ink and one warm signal.</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Every colour pair here clears WCAG 2.2 AA in both themes. Amber is rationed to actions and focus; severity never relies on colour alone.
        </p>
      </motion.div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
        <motion.div {...reveal}>
          <Card className="rounded-3xl border border-border bg-card/90 shadow-soft ring-0">
            <CardHeader><CardTitle className="font-display text-2xl">Amber scale</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid grid-cols-6 gap-2 sm:grid-cols-11 sm:gap-1.5">
                {STEPS.map((s) => (
                  <li key={s} className="text-center">
                    <div className={`${STEP_BG[s]} h-14 rounded-lg border border-border/60`} role="img" aria-label={`amber ${s}`} />
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-8 font-display text-2xl">Severity</h3>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <SeverityBadge severity="critical" count={3} />
                <SeverityBadge severity="serious" count={7} />
                <SeverityBadge severity="moderate" count={5} />
                <SeverityBadge severity="minor" count={9} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...reveal}>
          <Card className="rounded-3xl border border-border bg-card/90 shadow-soft ring-0">
            <CardHeader><CardTitle className="font-display text-2xl">Controls</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div>
                <label htmlFor="ds-input" className="mb-2 block font-semibold">Input with visible focus</label>
                <Input id="ds-input" placeholder="Tab or click here" />
              </div>
              <div className="space-y-2" aria-label="Loading skeleton example" role="img">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </div>
              <div className="border-t border-border pt-5">
                <p className="font-display text-4xl font-semibold">Fraunces <span className="italic">display</span></p>
                <p className="mt-2 text-lg">Atkinson Hyperlegible Next — designed by the Braille Institute for maximum character recognition.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
