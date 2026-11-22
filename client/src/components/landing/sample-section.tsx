import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { buttonVariants } from "@/components/ui/button"
import { Reveal } from "./reveal"

/** Teaser for the static sample report: no account needed. */
export function SampleSection() {
  return (
    <section aria-labelledby="sample-title" className="container-page py-8 sm:py-12">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-lift sm:p-8">
            <div className="flex items-center gap-5">
              <span className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-foreground font-display text-4xl font-semibold tabular-nums" aria-hidden="true">13</span>
              <div><p className="text-sm font-semibold text-muted-foreground">Grade F · Desktop</p><p className="font-display text-2xl font-semibold leading-tight">W3C &ldquo;Before and After&rdquo; demo</p></div>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2"><li><SeverityBadge severity="critical" count={34} /></li><li><SeverityBadge severity="serious" count={10} /></li><li><SeverityBadge severity="moderate" count={23} /></li></ul>
            <p className="mt-5 text-muted-foreground">33 images with no alt text, a select with no name, unreadable links, a keyboard path that drops focus 14 times, and AI fixes that were verified by axe.</p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="order-1 lg:order-2">
          <p className="eyebrow">No account needed</p>
          <h2 id="sample-title" className="mt-3 text-4xl font-semibold sm:text-5xl">Open a real report.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Explore the full report of a deliberately inaccessible page: the issue map, the vision simulator, the keyboard path and the AI fixes. Everything is clickable.</p>
          <Link to="/sample" className={`${buttonVariants({ size: "lg" })} mt-7 h-14 px-8 text-lg`}>Explore the sample report<ArrowRight aria-hidden="true" /></Link>
        </Reveal>
      </div>
    </section>
  )
}
