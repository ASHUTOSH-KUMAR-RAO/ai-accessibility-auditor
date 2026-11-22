import { motion } from "framer-motion"
import { BrailleText } from "@/components/brand/braille-text"
import { DesignSystemPreview } from "@/components/design-system-preview"
import { HeroReportCard } from "@/components/hero-report-card"
import { UrlForm } from "@/components/url-form"
import { useMotionScale } from "@/lib/motion"

export default function Home() {
  const { distance, speed } = useMotionScale()
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 32 * distance },
    animate: { opacity: 1, y: 0 },
    transition: { delay: (0.08 + i * 0.11) * speed, duration: 0.7 * speed, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <>
      <section aria-labelledby="hero-title" className="container-page grid items-center gap-14 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pt-24">
        <div className="min-w-0">
          <motion.div {...rise(0)} className="flex items-center gap-4">
            <BrailleText text="a11y" />
            <span className="eyebrow">WCAG 2.2 auditor</span>
          </motion.div>

          <motion.h1 id="hero-title" {...rise(1)} className="mt-6 text-[2.75rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            Accessibility, made{" "}
            <span className="relative inline-block italic">
              visible.
              <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-1 left-0 h-2.5 w-full text-primary">
                <motion.path
                  d="M2 8 C 40 2, 80 12, 120 6 S 180 4, 198 7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9 * speed, duration: 0.9 * speed, ease: "easeOut" }}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p {...rise(2)} className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Paste any URL. AccessLens scans it against WCAG, scores it, and an AI explains every problem in plain words — with the fixed code ready to copy.
          </motion.p>

          <motion.div {...rise(3)} className="mt-9 max-w-xl">
            <UrlForm />
          </motion.div>
        </div>

        <motion.div {...rise(2)} className="min-w-0">
          <HeroReportCard />
        </motion.div>
      </section>

      <DesignSystemPreview />
    </>
  )
}
