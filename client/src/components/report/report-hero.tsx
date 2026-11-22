import { motion } from "framer-motion"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { useMotionScale } from "@/lib/motion"
import type { Report } from "@/lib/report"
import { SEVERITIES } from "@/lib/severity"
import { ScoreGauge } from "./score-gauge"

export function ReportHero({ report }: { report: Report }) {
  const { distance, speed } = useMotionScale()
  const { scan, severity, counts } = report
  return (
    <section aria-labelledby="hero-heading" className="rounded-3xl border border-border bg-card/90 p-6 shadow-soft sm:p-10">
      <div className="flex flex-col items-center gap-10 md:flex-row md:items-center">
        <ScoreGauge score={scan.score} grade={scan.grade} />
        <div className="min-w-0 flex-1">
          <h2 id="hero-heading" className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
            <span className="sr-only">Grade {scan.grade}. </span>{scan.verdict}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            <strong className="font-semibold text-foreground">{counts.issues}</strong> {counts.issues === 1 ? "rule is" : "rules are"} failing ·{" "}
            <strong className="font-semibold text-foreground">{counts.passed}</strong> passed ·{" "}
            <strong className="font-semibold text-foreground">{counts.review}</strong> to review
          </p>
          <h3 className="mt-6 text-base font-semibold">Affected elements by severity</h3>
          <ul className="mt-2 flex flex-wrap gap-2.5">
            {SEVERITIES.map((s, i) => (
              <motion.li
                key={s}
                initial={{ opacity: 0, y: 14 * distance }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (0.5 + i * 0.1) * speed, duration: 0.5 * speed }}
              >
                <SeverityBadge severity={s} count={severity.find((x) => x.impact === s)?.elements ?? 0} className="text-base" />
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
