import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { Eye, EyeOff, Maximize2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useMotionScale } from "@/lib/motion"
import type { Report } from "@/lib/report"
import { SEVERITIES, SEVERITY, type Severity } from "@/lib/severity"
import { cn } from "@/lib/utils"
import { useViewer } from "./viewer-store"

const STEPS = [0.25, 0.35, 0.5, 0.75, 1, 1.5, 2]
const PAD = 12

/**
 * Full-page screenshot with an overlay box + numbered marker per affected element.
 * Severity is shown three ways: colour, icon shape + number badge, and fill/outline pattern.
 * Markers use a roving tabindex: Tab enters the group once, arrow keys walk the markers.
 */
export default function ScreenshotViewer({ report, src }: { report: Report; src: string }) {
  const shot = report.screenshot!
  const { selectedId, showNonce, selectFromMarker } = useViewer()
  const { reduced } = useMotionScale()
  const scroller = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit")
  const [overlays, setOverlays] = useState(true)
  const [shown, setShown] = useState<Severity[]>([...SEVERITIES])
  const [focusId, setFocusId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth - PAD * 2))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = containerW > 0 ? containerW / shot.width : 0.3
  const zoom = zoomMode === "fit" ? fit : zoomMode
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const ruleHelp = useMemo(() => new Map(report.rules.map((r) => [r.id, r.help])), [report.rules])
  const markers = useMemo(() => report.markers.filter((m) => m.box.y < shot.height), [report.markers, shot.height])
  const byId = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers])
  const visible = useMemo(() => (overlays ? markers.filter((m) => shown.includes(m.impact)) : []), [markers, overlays, shown])
  const counts = useMemo(() => Object.fromEntries(SEVERITIES.map((s) => [s, markers.filter((m) => m.impact === s).length])) as Record<Severity, number>, [markers])
  const tabbableId = visible.some((m) => m.id === focusId) ? focusId : visible.some((m) => m.id === selectedId) ? selectedId : visible[0]?.id

  // "Show on page": zoom in if we're far out, then centre the element (the pulse is drawn on the selected marker)
  /* eslint-disable react-hooks/set-state-in-effect -- reacting to an external trigger (the list's button) */
  useEffect(() => {
    if (!showNonce || !selectedId || !byId.has(selectedId)) return
    if (zoomRef.current < 0.75) setZoomMode(0.75)
    setOverlays(true)
    setShown((s) => (s.includes(byId.get(selectedId)!.impact) ? s : [...s, byId.get(selectedId)!.impact]))
    setPending(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the nonce is a trigger
  }, [showNonce])

  useEffect(() => {
    const m = pending ? byId.get(pending) : null
    const el = scroller.current
    if (!m || !el || containerW <= 0) return
    el.scrollTo({
      left: (m.box.x + m.box.width / 2) * zoom + PAD - el.clientWidth / 2,
      top: (m.box.y + m.box.height / 2) * zoom + PAD - el.clientHeight / 2,
      behavior: reduced ? "auto" : "smooth",
    })
    setPending(null)
  }, [pending, zoom, containerW, byId, reduced])
  /* eslint-enable react-hooks/set-state-in-effect */

  const stepZoom = (dir: 1 | -1) => {
    const z = zoomRef.current
    setZoomMode(dir === 1 ? (STEPS.find((s) => s > z + 0.001) ?? STEPS.at(-1)!) : ([...STEPS].reverse().find((s) => s < z - 0.001) ?? STEPS[0]!))
  }

  const onScrollerKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "+" || e.key === "=") stepZoom(1)
    else if (e.key === "-") stepZoom(-1)
    else if (e.key === "0") setZoomMode("fit")
    else return
    e.preventDefault()
  }

  const onMarkerKey = (e: KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => i + 1, ArrowDown: (i) => i + 1, ArrowLeft: (i) => i - 1, ArrowUp: (i) => i - 1, Home: () => 0, End: () => visible.length - 1,
    }
    const move = keys[e.key]
    if (!move) return
    const from = visible.findIndex((m) => m.id === (e.target as HTMLElement).dataset.markerId)
    if (from < 0) return
    e.preventDefault()
    const next = visible[Math.max(0, Math.min(visible.length - 1, move(from)))]
    if (!next) return
    setFocusId(next.id)
    const btn = document.getElementById(`marker-${next.id}`)
    btn?.focus()
    btn?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  const hiddenBelow = report.markers.length - markers.length
  const unlocated = report.rules.reduce((n, r) => n + r.storedNodes, 0) - report.markers.length

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div role="toolbar" aria-label="Screenshot controls" className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => stepZoom(-1)} aria-label="Zoom out"><ZoomOut aria-hidden="true" /></Button>
        <span className="min-w-12 text-center text-sm font-semibold tabular-nums" aria-live="polite"><span className="sr-only">Zoom </span>{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="icon-sm" onClick={() => stepZoom(1)} aria-label="Zoom in"><ZoomIn aria-hidden="true" /></Button>
        <Button variant="outline" size="sm" onClick={() => setZoomMode("fit")} aria-pressed={zoomMode === "fit"}><Maximize2 aria-hidden="true" />Fit width</Button>
        <Button variant="outline" size="sm" onClick={() => setZoomMode(1)} aria-pressed={zoomMode === 1}>100%</Button>
        <Button variant={overlays ? "default" : "outline"} size="sm" onClick={() => setOverlays((v) => !v)} aria-pressed={overlays}>
          {overlays ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}Highlights
        </Button>
      </div>

      <ToggleGroup multiple value={shown} onValueChange={(v) => setShown(v as Severity[])} aria-label="Show highlights for" spacing={1} className="flex-wrap">
        {SEVERITIES.map((s) => {
          const { icon: Icon, label, cssVar, pattern, iconClass } = SEVERITY[s]
          return (
            <ToggleGroupItem
              key={s} value={s} disabled={!overlays || counts[s] === 0}
              className="h-9 cursor-pointer gap-1.5 rounded-lg border border-border px-2.5 text-sm font-semibold data-[pressed]:bg-accent data-[pressed]:text-foreground disabled:cursor-not-allowed"
            >
              <span aria-hidden="true" className={cn("size-3.5 rounded-[3px] border border-border opacity-80", pattern)} style={{ "--c": `var(${cssVar})` } as CSSProperties} />
              <Icon className={cn("size-4", iconClass)} aria-hidden="true" />
              <span>{label}</span>
              <span className="tabular-nums text-muted-foreground">{counts[s]}<span className="sr-only"> highlights</span></span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Screenshot of the scanned page. Scroll to move. Plus and minus keys zoom, zero fits the width."
        onKeyDown={onScrollerKey}
        className="relative min-h-72 flex-1 overflow-auto rounded-2xl border border-border bg-muted"
        style={{ padding: PAD }}
      >
        <div className="relative" style={{ width: shot.width * zoom, height: shot.height * zoom }}>
          <img
            src={src} width={shot.width} height={shot.height} draggable={false}
            alt={`Full-page screenshot of ${report.scan.pageTitle || report.scan.url}, ${shot.width} by ${shot.height} pixels. Highlighted boxes mark elements with accessibility problems.`}
            className="block size-full max-w-none select-none"
          />
          <div role="group" aria-label={`${visible.length} highlighted elements. Tab to enter, then use the arrow keys to move between them and Enter to open the issue.`} onKeyDown={onMarkerKey} className="absolute inset-0">
            {visible.map((m) => {
              const meta = SEVERITY[m.impact]
              const selected = m.id === selectedId
              const x = m.box.x * zoom
              const y = m.box.y * zoom
              const color = `var(${meta.cssVar})`
              return (
                <button
                  key={m.id} id={`marker-${m.id}`} data-marker-id={m.id} type="button"
                  tabIndex={m.id === tabbableId ? 0 : -1}
                  aria-label={`Issue ${m.n}: ${ruleHelp.get(m.ruleId) ?? m.ruleId}. ${meta.label}.`}
                  aria-current={selected || undefined}
                  onClick={() => selectFromMarker(m.id)}
                  onFocus={() => setFocusId(m.id)}
                  className={cn("absolute cursor-pointer rounded-[3px] outline-none focus-visible:z-30", selected ? "z-20" : "z-10")}
                  style={{
                    left: x, top: y, width: Math.max(m.box.width * zoom, 14), height: Math.max(m.box.height * zoom, 14),
                    "--c": color, "--pulse-color": color,
                    border: `3px ${meta.border} ${color}`,
                    boxShadow: `0 0 0 2px rgb(255 255 255 / .9)${selected ? ", 0 0 0 6px var(--ring)" : ""}`,
                  } as CSSProperties}
                >
                  <span aria-hidden="true" className={cn("absolute inset-0 opacity-25", meta.pattern)} />
                  {selected && <span key={showNonce} aria-hidden="true" className="pulse absolute inset-0 rounded-[3px]" />}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 inline-flex items-center gap-0.5 rounded-md border-2 bg-card px-1 text-[11px] leading-4 font-bold text-foreground"
                    style={{ borderColor: color, top: y < 20 ? 0 : -20 }}
                  >
                    <meta.icon className="size-3" style={{ color }} />{m.n}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {markers.length} of {report.rules.reduce((n, r) => n + r.storedNodes, 0)} elements are marked.
        {unlocated - hiddenBelow > 0 && ` ${unlocated - hiddenBelow} couldn't be located (hidden, inside frames, or added by script).`}
        {hiddenBelow > 0 && ` ${hiddenBelow} are below the captured area (the screenshot stops at ${shot.height}px).`}
      </p>
    </div>
  )
}
