import { useEffect, useRef } from "react"
import { Globe, ScanSearch, Share2, Sparkles, type LucideIcon } from "lucide-react"
import { useMotionScale } from "@/lib/motion"
import { Reveal } from "./reveal"

const STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Globe, title: "Enter a URL", text: "Any public web page. We load it in a real browser, on desktop or mobile size." },
  { icon: ScanSearch, title: "Scan with axe-core", text: "The industry-standard engine checks it against WCAG 2.2, and we walk the Tab order like a keyboard user." },
  { icon: Sparkles, title: "AI explains and fixes", text: "Plain-English reasons, minimal code changes, and an automatic re-check so you know the fix works." },
  { icon: Share2, title: "Share and track", text: "Send a read-only link or a PDF, then re-scan and compare to watch your score climb." },
]

/**
 * The line between the steps is drawn as you scroll (GSAP ScrollTrigger, loaded only when this section mounts).
 * Reduced motion: the same drawing and the same step reveals, just calmer.
 */
export default function HowItWorks() {
  const root = useRef<HTMLOListElement>(null)
  const { distance } = useMotionScale()

  useEffect(() => {
    const el = root.current
    if (!el) return
    let cleanup = () => {}
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger)
      const ctx = gsap.context(() => {
        gsap.fromTo(".hiw-line", { scaleY: 0 }, { scaleY: 1, ease: "none", transformOrigin: "top", scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 60%", scrub: 0.6 } })
        gsap.utils.toArray<HTMLElement>(".hiw-step").forEach((step) => {
          gsap.fromTo(step, { opacity: 0, x: 40 * distance }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: step, start: "top 82%" } })
          gsap.fromTo(step.querySelector(".hiw-dot"), { scale: 0.6, backgroundColor: "var(--card)" }, { scale: 1, backgroundColor: "var(--foreground)", duration: 0.5, ease: "back.out(2)", scrollTrigger: { trigger: step, start: "top 70%" } })
        })
      }, el)
      cleanup = () => ctx.revert()
    })
    return () => cleanup()
  }, [distance])

  return (
    <section aria-labelledby="how-title" className="container-page py-8 sm:py-12">
      <Reveal className="max-w-3xl">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="mt-3 text-4xl font-semibold sm:text-5xl">From address to fixed code in four steps.</h2>
      </Reveal>
      <ol ref={root} className="relative mt-14 space-y-12 pl-14 sm:pl-20">
        <span aria-hidden="true" className="absolute bottom-4 left-[1.4rem] top-4 w-0.5 bg-foreground/15 sm:left-[2.15rem]" />
        <span aria-hidden="true" className="hiw-line absolute bottom-4 left-[1.4rem] top-4 w-0.5 origin-top bg-primary sm:left-[2.15rem]" />
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="hiw-step relative">
            <span className="hiw-dot absolute -left-14 top-0 grid size-11 place-items-center rounded-full border-2 border-foreground bg-foreground text-background sm:-left-20 sm:size-[3.4rem]" aria-hidden="true"><Icon className="size-5 sm:size-6" /></span>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step {i + 1}</p>
            <h3 className="mt-1 font-sans text-2xl font-semibold">{title}</h3>
            <p className="mt-2 max-w-xl text-lg text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
