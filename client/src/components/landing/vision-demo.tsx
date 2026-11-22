import { useId, useState } from "react"
import { VisionFilters } from "@/components/report/vision-filters"
import { VISION_TYPES, visionInfo, type VisionId } from "@/lib/vision"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"

const OPTIONS: Array<{ id: VisionId; label: string }> = [{ id: "none", label: "Normal vision" }, ...VISION_TYPES.map((v) => ({ id: v.id, label: v.label.split(" (")[0]! }))]

/** The real simulator, on a sample page: switch the type and the picture changes. Runs entirely in the browser. */
export default function VisionDemo() {
  const uid = useId().replace(/:/g, "")
  const [type, setType] = useState<VisionId>("deuteranopia")
  const info = visionInfo(type)
  return (
    <section aria-labelledby="vision-title" className="container-page py-8 sm:py-12">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <p className="eyebrow">Try it now</p>
          <h2 id="vision-title" className="mt-3 text-4xl font-semibold sm:text-5xl">See your page the way they do.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Pick a type of vision. This is the same simulator you get on every report, using scientifically derived colour matrices.</p>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">Type of vision</legend>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((o) => (
                <label key={o.id} className={cn("inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-base font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", type === o.id ? "border-2 border-foreground bg-accent" : "border-border bg-card hover:bg-accent")}>
                  <input type="radio" name={`${uid}-v`} value={o.id} checked={type === o.id} onChange={() => setType(o.id)} className="sr-only" />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div role="status" aria-live="polite" className="mt-6 min-h-28 rounded-2xl border border-border bg-card/90 p-4">
            {info ? (<><p className="font-semibold">{info.label}</p><p className="mt-1 text-muted-foreground">{info.what}</p><p className="mt-1 text-sm"><strong>How common:</strong> {info.prevalence}</p></>) : <p className="text-muted-foreground">This is the page as most people see it. Choose a type to compare.</p>}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <VisionFilters id={uid} scale={0.45} />
          <figure className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
            <img
              src="/demo/screenshot.webp" width={1280} height={900} loading="lazy" decoding="async"
              alt={info ? `Sample web page as seen with ${info.label}` : "Sample web page as seen with normal vision"}
              className="block aspect-[16/11] w-full object-cover object-top transition-[filter] duration-500"
              style={{ filter: type === "none" ? undefined : `url(#${uid}-${type})` }}
            />
            <figcaption className="border-t border-border px-4 py-2 text-sm text-muted-foreground">Sample page: W3C&apos;s deliberately inaccessible &ldquo;Before and After&rdquo; demonstration.</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
