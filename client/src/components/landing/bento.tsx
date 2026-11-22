import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight, FileText, GitCompareArrows, Keyboard, Link2, MapPin, ShieldCheck, Sparkles, TrendingUp, Glasses, type LucideIcon } from "lucide-react"
import { useMotionScale } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"

function Card({ icon: Icon, title, text, className, children }: { icon: LucideIcon; title: string; text: string; className?: string; children: ReactNode }) {
  const { distance } = useMotionScale()
  return (
    <motion.article
      whileHover={{ y: -6 * distance }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn("group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card/90 p-6 shadow-soft transition-shadow hover:shadow-lift", className)}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-border bg-background" aria-hidden="true"><Icon className="size-5" /></span>
        <h3 className="font-sans text-xl font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <div className="mt-5 flex-1" aria-hidden="true">{children}</div>
    </motion.article>
  )
}

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <code className={cn("block rounded-md px-2 py-0.5 font-mono text-[0.78rem]", className)}>{children}</code>

function DiffVisual() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-(--code-bg) p-3">
      <Mono className="bg-[var(--diff-del)]"><span className="mr-2 font-bold text-[var(--diff-del-mark)]">−</span>{'<img src="logo.png">'}</Mono>
      <Mono className="bg-[var(--diff-add)]"><span className="mr-2 font-bold text-[var(--diff-add-mark)]">+</span>{'<img src="logo.png" alt="Acme logo">'}</Mono>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sev-minor/70 bg-sev-minor/12 px-2.5 py-0.5 text-sm font-semibold"><ShieldCheck className="size-4" />Verified fix</span>
    </div>
  )
}
function MapVisual() {
  const m: Array<[string, string, string]> = [["12%", "18%", "var(--sev-critical)"], ["55%", "30%", "var(--sev-serious)"], ["30%", "62%", "var(--sev-moderate)"], ["70%", "70%", "var(--sev-critical)"]]
  return (
    <div className="relative h-36 overflow-hidden rounded-2xl border border-border bg-muted/60">
      <span className="absolute left-3 top-3 h-2.5 w-1/3 rounded bg-foreground/20" /><span className="absolute left-3 top-9 h-2 w-1/2 rounded bg-foreground/10" /><span className="absolute bottom-3 right-3 h-14 w-1/3 rounded bg-foreground/10" />
      {m.map(([x, y, c], i) => <span key={i} className="absolute grid size-7 place-items-center rounded-md border-2 bg-card text-xs font-bold" style={{ left: x, top: y, borderColor: c }}>{i + 1}</span>)}
    </div>
  )
}
function VisionVisual() {
  const sw = [["#d93025", "#8c7a2a", "#a89b3c", "#757575"], ["#188038", "#a18a2c", "#b5a243", "#8a8a8a"], ["#1a73e8", "#1a73e8", "#2e8fa0", "#5f5f5f"]]
  return (
    <div className="space-y-1.5">
      {["Normal", "Deuteranopia", "Protanopia"].map((l, r) => (
        <div key={l} className="flex items-center gap-2"><span className="w-24 text-xs font-semibold text-muted-foreground">{l}</span>{sw[r]!.map((c, i) => <span key={i} className="h-6 flex-1 rounded-md border border-border" style={{ background: r === 0 ? ["#d93025", "#188038", "#1a73e8", "#f9ab00"][i] : c }} />)}</div>
      ))}
    </div>
  )
}
function KeyboardVisual() {
  const pts = [[14, 62], [38, 22], [64, 52], [86, 20]] as const
  return (
    <svg viewBox="0 0 100 80" className="h-32 w-full rounded-2xl border border-border bg-muted/60">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--foreground)" strokeWidth="1.6" strokeDasharray="3 2" />
      {pts.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="7" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.6" /><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="var(--foreground)">{i + 1}</text></g>)}
    </svg>
  )
}
function PdfVisual() {
  return (
    <div className="flex items-end gap-2">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 flex-1 rounded-md border border-border bg-background p-2 shadow-soft" style={{ transform: `rotate(${(i - 1) * 5}deg)` }}><span className="block h-2 w-2/3 rounded bg-foreground/60" /><span className="mt-2 block h-1.5 w-full rounded bg-foreground/15" /><span className="mt-1 block h-1.5 w-5/6 rounded bg-foreground/15" /><span className="mt-1 block h-1.5 w-2/3 rounded bg-foreground/15" /></div>)}
    </div>
  )
}
function ShareVisual() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid grid-cols-5 gap-0.5 rounded-md border border-border bg-white p-1.5">{Array.from({ length: 25 }, (_, i) => <span key={i} className={cn("size-2.5", [0, 1, 4, 5, 6, 9, 12, 14, 18, 20, 23, 24, 10, 16].includes(i) ? "bg-foreground" : "bg-transparent")} />)}</div>
      <div className="min-w-0 text-sm"><p className="truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">accesslens/r/x7Qp…</p><p className="mt-1 text-muted-foreground">Expires in 7 days · read-only</p></div>
    </div>
  )
}
function TrendVisual() {
  const pts = [34, 41, 38, 55, 62, 74]
  return (
    <div className="flex items-end gap-4">
      <svg viewBox="0 0 120 50" className="h-20 flex-1"><polyline fill="none" stroke="var(--foreground)" strokeWidth="2" points={pts.map((p, i) => `${i * 22 + 4},${48 - p * 0.6}`).join(" ")} />{pts.map((p, i) => <circle key={i} cx={i * 22 + 4} cy={48 - p * 0.6} r="2.8" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.6" />)}</svg>
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-border px-2.5 py-0.5 text-sm font-semibold"><TrendingUp className="size-4" />+12 points</span>
    </div>
  )
}

export function Bento() {
  return (
    <section aria-labelledby="features-title" className="container-page py-8 sm:py-12">
      <Reveal className="max-w-3xl">
        <p className="eyebrow">Everything in one place</p>
        <h2 id="features-title" className="mt-3 text-4xl font-semibold sm:text-5xl">More than a score. A way to actually fix it.</h2>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
        <Reveal className="lg:col-span-3"><Card icon={Sparkles} title="AI fixes, verified" text="Every fix is re-checked with axe-core in an isolated browser before it reaches you. You see whether it really passes." className="h-full"><DiffVisual /></Card></Reveal>
        <Reveal delay={0.08} className="lg:col-span-3"><Card icon={MapPin} title="Screenshot issue map" text="Numbered boxes on the real page show where each problem lives. Click one to jump to its code." className="h-full"><MapVisual /></Card></Reveal>
        <Reveal delay={0.04} className="lg:col-span-2"><Card icon={Glasses} title="Vision simulator" text="See your page as colour-blind, low-vision and cataract visitors do." className="h-full"><VisionVisual /></Card></Reveal>
        <Reveal delay={0.1} className="lg:col-span-2"><Card icon={Keyboard} title="Keyboard tab map" text="Follow the Tab path. Find traps, invisible focus and unreachable buttons." className="h-full"><KeyboardVisual /></Card></Reveal>
        <Reveal delay={0.16} className="lg:col-span-2"><Card icon={FileText} title="PDF reports" text="A branded, tagged PDF with summary, fixes and the full rule list." className="h-full"><PdfVisual /></Card></Reveal>
        <Reveal delay={0.04} className="lg:col-span-3"><Card icon={Link2} title="Share links" text="Send a read-only report with an expiry date. Revoke it any time." className="h-full"><ShareVisual /></Card></Reveal>
        <Reveal delay={0.1} className="lg:col-span-3"><Card icon={GitCompareArrows} title="Compare and trends" text="Match issues between scans to see what you fixed, what is new, and how your score moves." className="h-full"><TrendVisual /></Card></Reveal>
      </div>
      <Reveal className="mt-8"><Link to="/features" className="inline-flex items-center gap-1.5 font-semibold text-link underline underline-offset-4">All features in detail<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Reveal>
    </section>
  )
}
