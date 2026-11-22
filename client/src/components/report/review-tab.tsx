import { ClipboardCheck, ExternalLink } from "lucide-react"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { Report } from "@/lib/report"
import { CodeSnippet } from "./code-snippet"
import { CopyButton } from "./copy-button"
import { CriteriaChips, LevelChips } from "./wcag-chips"

/** axe "incomplete": the tool couldn't decide, so a person has to look. */
export function ReviewTab({ report }: { report: Report }) {
  if (report.review.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-10 text-center">
        <ClipboardCheck className="mx-auto size-10" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl font-semibold">Nothing needs a manual look</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">The automated checks could decide everything they tested on this page.</p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl font-semibold">Needs review</h2>
        <p className="mt-1 max-w-2xl text-muted-foreground">These checks couldn't be decided automatically. They are not counted as failures: look at each one and decide.</p>
      </div>
      <Accordion multiple className="gap-3">
        {report.review.map((r) => (
          <AccordionItem key={r.id} value={r.id} className="rounded-2xl border border-border bg-card/90 shadow-soft not-last:border-b">
            <AccordionTrigger className="items-center gap-3 rounded-2xl p-4 text-base hover:no-underline sm:p-5">
              <span className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  {r.impact ? <SeverityBadge severity={r.impact} /> : <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold">Check manually</span>}
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{r.totalNodes} {r.totalNodes === 1 ? "element" : "elements"}</span>
                </span>
                <span className="font-display text-xl font-semibold leading-snug">{r.help}</span>
              </span>
            </AccordionTrigger>
            <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
              <CriteriaChips criteria={r.criteria} />
              <LevelChips level={r.level} principle={r.principle} />
            </div>
            <AccordionContent className="space-y-4 px-4 pb-5 text-base sm:px-5">
              <div className="rounded-xl border border-border bg-muted/60 p-4">
                <h4 className="text-sm font-semibold">What to check</h4>
                <p className="mt-1">{r.guidance}</p>
              </div>
              <a href={r.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-link underline underline-offset-4">
                Learn more about “{r.id}”<ExternalLink className="size-4" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
              </a>
              {r.nodes.length > 0 && (
                <ul className="space-y-3">
                  {r.nodes.map((n, i) => (
                    <li key={`${n.selector}-${i}`} className="space-y-2 rounded-2xl border border-border bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">{n.selector}</code>
                        <CopyButton text={n.selector} label={`Copy selector for element ${i + 1}`} />
                      </div>
                      <CodeSnippet code={n.html} label={`HTML of element ${i + 1}`} />
                      {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {r.totalNodes > r.nodes.length && <p className="text-sm text-muted-foreground">Showing the first {r.nodes.length} of {r.totalNodes} elements.</p>}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
