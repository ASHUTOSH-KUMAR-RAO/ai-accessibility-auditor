import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpDown, CircleSlash, Hourglass, Unplug, EyeOff, Keyboard, MapPinOff, Repeat, Target, TriangleAlert, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useObjectUrl } from "@/lib/hooks"
import { useKeyboard, type TabOrder, type TabStop, type TabWarningType } from "@/lib/insights"
import { useMotionScale } from "@/lib/motion"
import type { Report } from "@/lib/report"
import { useScreenshotBlob } from "@/lib/scans"
import { cn } from "@/lib/utils"

const WARNING: Record<TabWarningType, { label: string; icon: LucideIcon }> = {
  "focus-jump": { label: "Focus jump", icon: ArrowUpDown },
  "invisible-focus": { label: "Invisible focus", icon: EyeOff },
  "focus-lost": { label: "Focus dropped", icon: Unplug },
  offscreen: { label: "Off-screen focus", icon: MapPinOff },
  trap: { label: "Keyboard trap", icon: Repeat },
  unreachable: { label: "Unreachable control", icon: CircleSlash },
}
const WARNING_ORDER: TabWarningType[] = ["trap", "focus-lost", "invisible-focus", "offscreen", "focus-jump", "unreachable"]

/** What a person with a keyboard actually meets, in plain words. */
const ADVICE: Record<TabWarningType, string> = {
  trap: "Keyboard users get stuck here and can't reach the rest of the page. Let Tab (or Escape) leave the component.",
  "focus-lost": "The link takes focus and a script (like onfocus=\"blur()\") throws it away, so keyboard users can never use it. Remove the script.",
  "invisible-focus": "People can't see where they are. Add a clear :focus-visible outline (at least 2px, 3:1 contrast).",
  offscreen: "Focus lands somewhere nobody can see. Hide it from the tab order, or reveal it when focused.",
  "focus-jump": "The order doesn't follow the layout. Reorder the HTML instead of using positive tabindex values.",
  unreachable: "Mouse users can click it, keyboard users can't. Use a real <button> or <a href>, or add tabindex=\"0\" and key handlers.",
}

function PathOverlay({ order, shot, selected }: { order: TabOrder; shot: NonNullable<Report["screenshot"]>; selected: number | null }) {
  const warned = useMemo(() => new Set(order.warnings.filter((w) => w.stop && w.type !== "focus-jump").map((w) => w.stop)), [order])
  const jumps = useMemo(() => new Set(order.warnings.filter((w) => w.type === "focus-jump").map((w) => w.stop)), [order])
  const pts = order.stops.filter((s) => !s.offscreen && s.box.y < shot.height && s.box.x < shot.width)
  const r = shot.width * 0.026
  const c = (s: TabStop) => [s.box.x + Math.min(s.box.width, 40) / 2, s.box.y + Math.min(s.box.height, 30) / 2] as const
  return (
    <svg viewBox={`0 0 ${shot.width} ${shot.height}`} aria-hidden="true" focusable="false" className="absolute inset-0 size-full">
      <defs>
        <marker id="kb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--foreground)" /></marker>
      </defs>
      {pts.slice(1).map((s, i) => {
        const [x1, y1] = c(pts[i]!)
        const [x2, y2] = c(s)
        const jump = jumps.has(s.n)
        return <line key={s.n} x1={x1} y1={y1} x2={x2} y2={y2} stroke={jump ? "var(--sev-critical)" : "var(--foreground)"} strokeWidth={jump ? 4 : 2.5} strokeDasharray={jump ? "10 7" : undefined} vectorEffect="non-scaling-stroke" opacity={0.85} markerEnd="url(#kb-arrow)" />
      })}
      {pts.map((s) => {
        const [x, y] = c(s)
        const bad = warned.has(s.n)
        const sel = selected === s.n
        return (
          <g key={s.n}>
            {sel && <circle cx={x} cy={y} r={r * 1.7} fill="none" stroke="var(--ring)" strokeWidth={5} vectorEffect="non-scaling-stroke" />}
            {bad ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} fill="var(--card)" stroke="var(--sev-critical)" strokeWidth={4} vectorEffect="non-scaling-stroke" /> : <circle cx={x} cy={y} r={r} fill="var(--card)" stroke="var(--foreground)" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={r * (s.n > 99 ? 0.85 : s.n > 9 ? 1.05 : 1.25)} fontWeight={700} fill="var(--foreground)">{s.n}</text>
          </g>
        )
      })}
    </svg>
  )
}

function PathMap({ report, order, selected }: { report: Report; order: TabOrder; selected: number | null }) {
  const shotMeta = report.screenshot!
  const blob = useScreenshotBlob(report.scan.id, true)
  const src = useObjectUrl(blob.data)
  const { reduced } = useMotionScale()
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stop = order.stops.find((s) => s.n === selected)
    const el = scroller.current
    if (!stop || !el) return
    const scale = el.scrollWidth / shotMeta.width
    el.scrollTo({ top: stop.box.y * scale - el.clientHeight / 2, behavior: reduced ? "auto" : "smooth" })
  }, [selected, order.stops, shotMeta.width, reduced])

  if (blob.isError) return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">The screenshot couldn't be loaded.</p>
  if (!src) return <Skeleton className="h-72 w-full rounded-2xl" aria-hidden="true" />
  return (
    <div ref={scroller} tabIndex={0} role="region" aria-label="Screenshot with the keyboard path drawn on it. The list on this page describes the same path." className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-muted">
      <div className="relative">
        <img src={src} width={shotMeta.width} height={shotMeta.height} alt="" draggable={false} className="block h-auto w-full select-none" />
        <PathOverlay order={order} shot={shotMeta} selected={selected} />
      </div>
    </div>
  )
}

export default function KeyboardTab({ report }: { report: Report }) {
  const q = useKeyboard(report.scan.id)
  const [selected, setSelected] = useState<number | null>(null)

  if (q.isPending) return <div role="status" className="space-y-3"><span className="sr-only">Loading keyboard map…</span><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  if (q.isError) return <p role="alert" className="rounded-2xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">Couldn't load the keyboard map.</p>
  const order = q.data.tabOrder
  if (!q.data.available || !order) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-10 text-center">
        <Keyboard className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl font-semibold">Not available for this scan</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Keyboard order is recorded while a page is scanned. This scan is older than that feature, or the recording didn't finish. Re-scan the page to get the map.</p>
      </div>
    )
  }

  const counts = WARNING_ORDER.map((t) => [t, order.warnings.filter((w) => w.type === t).length] as const).filter(([, n]) => n > 0)
  const warnedStops = new Map<number, TabWarningType[]>()
  for (const w of order.warnings) if (w.stop) warnedStops.set(w.stop, [...(warnedStops.get(w.stop) ?? []), w.type])
  const showMap = !!report.screenshot && order.stops.length > 0
  const pick = (n: number) => setSelected(n)

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Keyboard navigation</h2>
      {order.timedOut && (
        <p role="status" className="flex gap-2 rounded-2xl border-2 border-border bg-muted p-4 font-semibold">
          <Hourglass className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Partial keyboard map (site was slow). We recorded {order.stops.length} {order.stops.length === 1 ? "stop" : "stops"} before time ran out, so later parts of the page aren't covered.
        </p>
      )}
      <section aria-labelledby="kb-summary" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-6">
        <h3 id="kb-summary" className="font-display text-2xl font-semibold">
          {order.stops.length === 0 ? "Nothing on this page can take keyboard focus" : counts.length === 0 ? "Keyboard order looks healthy" : `${order.warnings.length} keyboard ${order.warnings.length === 1 ? "problem" : "problems"} found`}
        </h3>
        <p className="mt-1 text-muted-foreground">
          Pressing Tab moved focus through <strong className="text-foreground">{order.stops.length}</strong> {order.stops.length === 1 ? "stop" : "stops"}
          {order.truncated ? ` (we stop recording at ${order.stops.length})` : order.timedOut ? " before time ran out" : order.complete ? " before leaving the page" : ""}.
        </p>
        {counts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Problems by type">
            {counts.map(([t, n]) => {
              const { label, icon: Icon } = WARNING[t]
              return <li key={t} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 border-border bg-background px-3 text-sm font-semibold"><Icon className="size-4" aria-hidden="true" />{label}<span className="tabular-nums">{n}</span></li>
            })}
          </ul>
        )}
      </section>

      <div className={cn("grid gap-6", showMap && "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]")}>
        <div className="min-w-0 space-y-6">
          {order.warnings.length > 0 && (
            <section aria-labelledby="kb-warnings">
              <h3 id="kb-warnings" className="mb-3 text-lg font-semibold">What to fix</h3>
              <ul className="space-y-2">
                {WARNING_ORDER.flatMap((t) => order.warnings.filter((w) => w.type === t)).map((w, i) => {
                  const { label, icon: Icon } = WARNING[w.type]
                  return (
                    <li key={i} className="rounded-2xl border-2 border-border bg-card p-3">
                      <p className="flex items-start gap-2 font-semibold"><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span><span className="mr-2 rounded-md bg-muted px-1.5 text-sm">{label}</span>{w.message}</span></p>
                      <p className="mt-1 pl-6 text-sm text-muted-foreground">{ADVICE[w.type]}</p>
                      {w.stop && showMap && <Button variant="outline" size="sm" className="ml-6 mt-2" onClick={() => pick(w.stop!)}><Target aria-hidden="true" />Show stop {w.stop} on the map</Button>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {order.unreachable.length > 0 && (
            <section aria-labelledby="kb-unreachable">
              <h3 id="kb-unreachable" className="mb-3 text-lg font-semibold">Clickable, but not reachable with Tab</h3>
              <ul className="space-y-2">
                {order.unreachable.map((u, i) => (
                  <li key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <span className="font-semibold">{u.role || u.tag}</span>{u.name && <> “{u.name}”</>}
                    <code className="mt-1 block break-all rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">{u.selector}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {order.stops.length > 0 && (
            <section aria-labelledby="kb-stops">
              <h3 id="kb-stops" className="mb-3 text-lg font-semibold">Focus order</h3>
              <ol className="space-y-2">
                {order.stops.map((s) => {
                  const flags = warnedStops.get(s.n) ?? []
                  return (
                    <li key={s.n} className={cn("flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-3", selected === s.n ? "border-2 border-ring shadow-glow" : "border-border", flags.length > 0 && "border-l-4 border-l-sev-critical")}>
                      <span className="grid size-9 shrink-0 place-content-center rounded-full border-2 border-foreground font-bold tabular-nums"><span className="sr-only">Stop </span>{s.n}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold"><span className="mr-2 rounded-md bg-muted px-1.5 text-sm font-medium">{s.role}</span>{s.name || <span className="font-normal text-muted-foreground">(no accessible name)</span>}</p>
                        <code className="mt-1 block break-all text-[0.8rem] text-muted-foreground">{s.selector}</code>
                        {flags.length > 0 && (
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {flags.map((f) => { const { label, icon: Icon } = WARNING[f]; return <li key={f} className="inline-flex items-center gap-1 rounded-md border border-sev-critical/70 bg-sev-critical/10 px-1.5 text-sm font-semibold"><TriangleAlert className="size-3.5" aria-hidden="true" /><Icon className="size-3.5" aria-hidden="true" />{label}</li> })}
                          </ul>
                        )}
                      </div>
                      {showMap && !s.offscreen && <Button variant="outline" size="sm" onClick={() => pick(s.n)} aria-label={`Show stop ${s.n} on the map`}><Target aria-hidden="true" />Show</Button>}
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
        </div>

        {showMap && (
          <aside aria-labelledby="kb-map" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <h3 id="kb-map" className="mb-2 font-display text-2xl font-semibold">Keyboard path</h3>
            <p className="mb-3 text-sm text-muted-foreground">Numbered circles are stops in order. Diamonds have a problem. Dashed lines are big jumps.</p>
            <PathMap report={report} order={order} selected={selected} />
          </aside>
        )}
      </div>
    </div>
  )
}
