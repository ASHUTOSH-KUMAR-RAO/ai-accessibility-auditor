import { lazy, Suspense } from "react"
import { Defer } from "@/components/landing/defer"
import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { Hero } from "@/components/landing/hero"
import { Marquee } from "@/components/landing/marquee"
import { Problem } from "@/components/landing/problem"
import { SampleSection } from "@/components/landing/sample-section"
import { Bento } from "@/components/landing/bento"
import { useSeo } from "@/lib/seo"

// Heavy, below-the-fold pieces load only when you scroll near them
const VisionDemo = lazy(() => import("@/components/landing/vision-demo"))
const HowItWorks = lazy(() => import("@/components/landing/how-it-works"))

export default function Home() {
  useSeo({
    title: "AccessLens: AI website accessibility auditor",
    description: "Scan any website for WCAG accessibility problems. See exactly where they are, get plain-English explanations and AI-written fixes that are verified with axe-core.",
    path: "/",
  })
  return (
    <>
      <Hero />
      {/* Everything below the first screen renders (and loads its code) only when it is about to scroll into view */}
      <Defer id="problem" minHeight={420}><Problem /></Defer>
      <Defer id="features" minHeight={900}><Bento /></Defer>
      <Defer id="vision" minHeight={560}><Suspense fallback={null}><VisionDemo /></Suspense></Defer>
      <Defer id="how-it-works" minHeight={620}><Suspense fallback={null}><HowItWorks /></Suspense></Defer>
      <Defer id="sample" minHeight={420}><SampleSection /></Defer>
      <Defer minHeight={260}><Marquee /></Defer>
      <Defer id="faq" minHeight={640}><Faq /></Defer>
      <Defer minHeight={380}><FinalCta /></Defer>
    </>
  )
}
