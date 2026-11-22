import { Check, X } from "lucide-react"
import { CopyButton } from "@/components/report/copy-button"
import type { ContrastInfo } from "@/lib/ai"

function PassChip({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? Check : X
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-sm font-semibold">
      <Icon className="size-3.5" aria-hidden="true" />{label}: {ok ? "pass" : "fail"}
    </span>
  )
}

/** A swatch shows the text colour on its background; the hex is also written out because colour alone is not enough. */
function Swatch({ fg, bg, ratio, title, info, text, children }: { fg: string; bg: string; ratio: number; title: string; info: ContrastInfo; text?: string; children?: React.ReactNode }) {
  const aaTarget = info.largeText ? 3 : 4.5
  const aaaTarget = info.largeText ? 4.5 : 7
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="grid h-16 place-content-center rounded-xl border border-border text-lg font-bold" style={{ backgroundColor: bg, color: fg }} aria-hidden="true">{text ?? "Sample text"}</div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Text</dt>
        <dd className="flex items-center gap-1 font-mono">{fg}<CopyButton text={fg} label={`Copy text color ${fg}`} className="size-8" /></dd>
        <dt className="text-muted-foreground">Background</dt>
        <dd className="flex items-center gap-1 font-mono">{bg}<CopyButton text={bg} label={`Copy background color ${bg}`} className="size-8" /></dd>
        <dt className="text-muted-foreground">Contrast</dt>
        <dd className="font-semibold tabular-nums">{ratio}:1</dd>
      </dl>
      <div className="flex flex-wrap gap-1.5">
        <PassChip ok={ratio >= aaTarget} label={`AA ${aaTarget}:1`} />
        <PassChip ok={ratio >= aaaTarget} label={`AAA ${aaaTarget}:1`} />
      </div>
      {children}
    </div>
  )
}

/** Current colours vs the accessible ones we computed (never guessed by the AI). */
export function ContrastCard({ info }: { info: ContrastInfo }) {
  return (
    <section aria-labelledby="contrast-heading" className="space-y-3">
      <h3 id="contrast-heading" className="text-base font-semibold">Color contrast, calculated</h3>
      <p className="text-sm text-muted-foreground">
        {info.largeText ? "Large text" : "Normal-size text"} needs {info.required}:1 for WCAG AA. These numbers come from the WCAG formula, not from the AI.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Swatch fg={info.foreground} bg={info.background} ratio={info.ratio} title="Current" info={info} />
        {info.suggestions.map((s) => {
          const fg = s.kind === "foreground" ? s.color : info.foreground
          const bg = s.kind === "background" ? s.color : info.background
          return (
            <Swatch key={s.kind} fg={fg} bg={bg} ratio={s.ratio} info={info} title={s.kind === "foreground" ? "Suggested text color" : "Or suggested background"} />
          )
        })}
      </div>
      {info.suggestions.length === 0 && <p className="text-sm text-muted-foreground">No single color change reaches the target here: change both colors, or use black or white text.</p>}
    </section>
  )
}
