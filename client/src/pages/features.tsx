import type { LucideIcon } from "lucide-react"
import { ArrowRight, FileSearch, FileText, GitCompareArrows, Glasses, Keyboard, Link2, MapPin, Palette, ShieldCheck, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import { BrailleText } from "@/components/brand/braille-text"
import { Reveal } from "@/components/landing/reveal"
import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/context/auth-store"
import { useSeo } from "@/lib/seo"

interface Feature { id: string; icon: LucideIcon; title: string; lead: string; points: string[] }
const FEATURES: Feature[] = [
  { id: "scan", icon: ShieldCheck, title: "WCAG scanning you can trust", lead: "Every page is loaded in a real browser and checked by axe-core against WCAG 2.2 (A and AA) plus best practices.", points: ["Desktop and mobile viewport", "Score from 0 to 100 with a letter grade, and a clear explanation of how it is calculated", "Issues grouped by rule, severity, WCAG principle and level", "A separate list of things that need a human look, and the rules that passed"] },
  { id: "ai-fixes", icon: Sparkles, title: "AI fixes, checked before you see them", lead: "For each affected element you get a plain-English explanation, the smallest code change that fixes it, and steps to test.", points: ["HTML, CSS and React versions, shown as a before/after diff", "Every fix is re-checked with axe-core in an isolated, offline browser: Verified, Not verified or Needs page context", "If the first attempt fails the re-check, a stronger model gets one more try", "Without AI (no key, rate limit, outage) you get guided fixes from built-in rules, clearly labelled"] },
  { id: "contrast", icon: Palette, title: "Contrast fixed by maths, not guesses", lead: "For colour-contrast failures the real ratio is calculated and the nearest accessible colours are computed, so the numbers can be trusted.", points: ["Current and suggested colours side by side, with AA and AAA pass/fail", "Copy the hex value in one click", "The AI only explains the result, it never picks the colours"] },
  { id: "issue-map", icon: MapPin, title: "A screenshot issue map", lead: "Numbered boxes on a full-page screenshot show where each problem lives.", points: ["Severity shown by colour, icon, pattern and word, never colour alone", "Click a box to jump to its code, or press Show on page to find it", "Zoom, filter by severity, fully keyboard operable"] },
  { id: "vision", icon: Glasses, title: "Vision simulator", lead: "See the page as people with colour blindness, low vision or cataracts see it.", points: ["Protanopia, deuteranopia, tritanopia and achromatopsia using published colour matrices", "Low-vision blur and a cataract-like haze", "Slider and side-by-side comparison, with a short explanation and how common each condition is"] },
  { id: "keyboard", icon: Keyboard, title: "Keyboard tab-order map", lead: "AccessLens presses Tab through your page and draws the path on the screenshot.", points: ["Finds keyboard traps, invisible focus, off-screen focus and big focus jumps", "Catches links that throw focus away (onfocus=blur())", "Lists clickable elements the Tab key can never reach"] },
  { id: "pdf", icon: FileText, title: "Professional PDF reports", lead: "A branded, tagged PDF for clients and stakeholders.", points: ["Executive summary, score, breakdowns, top issues with fixes, keyboard summary, screenshot and a full rule appendix", "Real text, headings and bookmarks, so the PDF is itself accessible", "Created on our server with no network access"] },
  { id: "share", icon: Link2, title: "Share links", lead: "Send a read-only report to anyone, with no account needed.", points: ["Random unguessable link that you can set to expire (24 hours, 7 days, 30 days or never)", "Hide the screenshot if the page shows private content", "Revoke any time, with a QR code and an embeddable score badge"] },
  { id: "compare", icon: GitCompareArrows, title: "Compare scans and track trends", lead: "See what you fixed, what is new and what is still broken between two scans of a site.", points: ["Issues are matched even when the page changes a little", "Score trend per site, with an accessible data table", "Export issues as CSV or JSON"] },
]

export default function Features() {
  const { status } = useAuth()
  useSeo({ title: "Features", description: "WCAG scanning, verified AI fixes, a screenshot issue map, vision simulator, keyboard tab-order map, PDF reports, share links, comparisons and trends.", path: "/features" })
  return (
    <div className="container-page py-12 sm:py-16">
      <Reveal className="max-w-3xl">
        <BrailleText text="tools" />
        <h1 className="mt-5 text-5xl font-semibold sm:text-6xl">Everything you need to find it, fix it and prove it.</h1>
        <p className="mt-5 text-lg text-muted-foreground">AccessLens covers the whole loop: scan, understand, fix, verify, share and track. Here is what each part does.</p>
      </Reveal>
      <div className="mt-14 space-y-6">
        {FEATURES.map((f, i) => (
          <Reveal key={f.id} delay={0.03}>
            <section id={f.id} aria-labelledby={`${f.id}-t`} className="grid gap-5 rounded-3xl border border-border bg-card/90 p-6 shadow-soft sm:p-8 md:grid-cols-[0.9fr_1.1fr] md:gap-10">
              <div>
                <span className="grid size-12 place-items-center rounded-xl border border-border bg-background" aria-hidden="true"><f.icon className="size-6" /></span>
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
                <h2 id={`${f.id}-t`} className="mt-1 text-3xl font-semibold">{f.title}</h2>
                <p className="mt-3 text-lg text-muted-foreground">{f.lead}</p>
              </div>
              <ul className="list-disc space-y-2.5 pl-6 text-lg marker:text-foreground">{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </section>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-14 flex flex-wrap items-center gap-3">
        <Link to={status === "authenticated" ? "/dashboard" : "/signup"} className={`${buttonVariants({ size: "lg" })} h-14 px-8 text-lg`}>{status === "authenticated" ? "Go to your dashboard" : "Create a free account"}<ArrowRight aria-hidden="true" /></Link>
        <Link to="/sample" className={`${buttonVariants({ variant: "outline", size: "lg" })} h-14 px-8 text-lg`}><FileSearch aria-hidden="true" />See a sample report</Link>
      </Reveal>
    </div>
  )
}
