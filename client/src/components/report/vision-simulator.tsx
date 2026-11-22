import { useEffect, useId, useRef, useState } from "react"
import { Columns2, MoveHorizontal, Sparkles } from "lucide-react"
import type { Report } from "@/lib/report"
import { ACHROMATOPSIA, BLUR_PX, CATARACT_CONTRAST, CATARACT_TINT, MACHADO, matrixValues, VISION_TYPES, visionInfo, type VisionId } from "@/lib/vision"
import { cn } from "@/lib/utils"

type Mode = "simulated" | "slider" | "side"
const MODES: Array<{ id: Mode; label: string; icon: typeof Sparkles }> = [
  { id: "simulated", label: "Simulated", icon: Sparkles },
  { id: "slider", label: "Slider", icon: MoveHorizontal },
  { id: "side", label: "Side by side", icon: Columns2 },
]

/**
 * Colour matrices and blur are applied by SVG filters in the visitor's browser: no server work, nothing uploaded.
 * `scale` converts "pixels of the original page" to "pixels on screen" so the blur looks the same at any panel width.
 */
function Filters({ id, scale }: { id: string; scale: number }) {
  const blur = (px: number) => Math.max(0.4, px * scale)
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {(["protanopia", "deuteranopia", "tritanopia"] as const).map((k) => (
          <filter key={k} id={`${id}-${k}`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={matrixValues(MACHADO[k])} /></filter>
        ))}
        <filter id={`${id}-achromatopsia`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={matrixValues(ACHROMATOPSIA)} /></filter>
        <filter id={`${id}-low-vision`} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={blur(BLUR_PX["low-vision"])} /></filter>
        <filter id={`${id}-cataract`} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={blur(BLUR_PX.cataract)} />
          <feColorMatrix type="matrix" values={CATARACT_TINT} />
          <feComponentTransfer>
            <feFuncR type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
            <feFuncG type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
            <feFuncB type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}

export default function VisionSimulator({ report, src }: { report: Report; src: string }) {
  const shot = report.screenshot!
  const uid = useId().replace(/:/g, "")
  const [type, setType] = useState<Exclude<VisionId, "none">>("deuteranopia")
  const [mode, setMode] = useState<Mode>("simulated")
  const [split, setSplit] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [mode])

  const info = visionInfo(type)!
  const imgW = mode === "side" ? Math.max(0, (width - 12) / 2) : width
  const filter = `url(#${uid}-${type})`
  const alt = (kind: string) => `${kind} of the scanned page, ${shot.width} by ${shot.height} pixels.`
  const sim = <img src={src} alt={alt(`Simulated ${info.label} view`)} draggable={false} className="block h-auto w-full select-none" style={{ filter }} />
  const orig = <img src={src} alt={alt("Original view")} draggable={false} className="block h-auto w-full select-none" />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Filters id={uid} scale={imgW > 0 ? imgW / shot.width : 0.3} />

      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-semibold">Type of vision</legend>
        <div className="flex flex-wrap gap-1.5">
          {VISION_TYPES.map((v) => (
            <label
              key={v.id}
              className={cn("inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", type === v.id ? "border-2 border-foreground bg-accent" : "border-border bg-card hover:bg-accent")}
            >
              <input type="radio" name={`${uid}-type`} value={v.id} checked={type === v.id} onChange={() => setType(v.id)} className="sr-only" />
              {v.label.split(" (")[0]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="sr-only">Compare mode</legend>
        <div className="inline-flex rounded-xl border-2 border-input p-0.5">
          {MODES.map(({ id, label, icon: Icon }) => (
            <label key={id} className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", mode === id ? "bg-foreground text-background" : "hover:bg-accent")}>
              <input type="radio" name={`${uid}-mode`} value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
              <Icon className="size-4" aria-hidden="true" />{label}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby={`${uid}-about`} className="rounded-2xl border border-border bg-card p-3 text-sm">
        <h3 id={`${uid}-about`} className="font-sans text-base font-semibold">{info.label}</h3>
        <p className="mt-1">{info.what}</p>
        <p className="mt-1"><strong>How common:</strong> {info.prevalence}</p>
        <p className="mt-1"><strong>Design tip:</strong> {info.tip}</p>
      </section>

      <div ref={box} tabIndex={0} role="region" aria-label="Simulated screenshot. Scroll to see more of the page." className="relative min-h-60 flex-1 overflow-auto rounded-2xl border border-border bg-muted">
        {mode === "simulated" && sim}
        {mode === "side" && (
          <div className="grid grid-cols-2 gap-3">
            <figure><figcaption className="sticky top-0 z-10 bg-muted/90 px-2 py-1 text-sm font-semibold">Original</figcaption>{orig}</figure>
            <figure><figcaption className="sticky top-0 z-10 bg-muted/90 px-2 py-1 text-sm font-semibold">{info.label.split(" (")[0]}</figcaption>{sim}</figure>
          </div>
        )}
        {mode === "slider" && (
          <div className="relative">
            {sim}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>{orig}</div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-foreground ring-2 ring-background" style={{ left: `${split}%` }} />
            <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 rounded-md bg-card px-1.5 text-sm font-semibold">Original</span>
            <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 rounded-md bg-card px-1.5 text-sm font-semibold">Simulated</span>
          </div>
        )}
      </div>

      {mode === "slider" && (
        <div>
          <label htmlFor={`${uid}-split`} className="mb-1 block text-sm font-semibold">Compare: original ↔ simulated ({split}% original)</label>
          <input id={`${uid}-split`} type="range" min={0} max={100} step={1} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="h-8 w-full cursor-pointer accent-[var(--foreground)]" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">Colour-blindness types show the most severe form (Machado et al., 2009). Milder forms are more common. Everything is computed in your browser.</p>
    </div>
  )
}
