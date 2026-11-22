import { ExternalLink } from "lucide-react"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { Marker, ReportRule } from "@/lib/report"
import { NodeList } from "./node-list"
import { CriteriaChips, LevelChips, WhoAffected } from "./wcag-chips"

/** One failing rule: collapsed it shows severity, title, count and WCAG criteria; open it shows who is hurt and every element. */
export function RuleCard({ rule, scanId, markerById }: { rule: ReportRule; scanId: string; markerById: Map<string, Marker> }) {
  return (
    <AccordionItem data-rule-id={rule.id} value={rule.id} className="rounded-2xl border border-border bg-card/90 shadow-soft not-last:border-b">
      <AccordionTrigger className="items-center gap-3 rounded-2xl p-4 text-base hover:no-underline sm:p-5">
        <span className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={rule.impact} />
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {rule.totalNodes} {rule.totalNodes === 1 ? "element" : "elements"}{rule.approximate ? " (saved sample)" : ""}
            </span>
          </span>
          <span className="font-display text-xl font-semibold leading-snug">{rule.help}</span>
        </span>
      </AccordionTrigger>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
        <CriteriaChips criteria={rule.criteria} />
        <LevelChips level={rule.level} principle={rule.principle} />
      </div>

      <AccordionContent className="space-y-5 px-4 pb-5 text-base sm:px-5">
        <WhoAffected audiences={rule.audiences} />
        <p className="text-muted-foreground">{rule.description}</p>
        <a href={rule.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-link underline underline-offset-4">
          Learn more about “{rule.id}”<ExternalLink className="size-4" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
        </a>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Affected elements</h4>
          <NodeList scanId={scanId} rule={rule} markerById={markerById} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
