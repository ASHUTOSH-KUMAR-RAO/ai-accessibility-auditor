import { CircleCheck } from "lucide-react"
import type { Report } from "@/lib/report"
import { LEVEL_LABEL } from "@/lib/report"

/** Compact list of rules that passed: id + what it checks. */
export function PassedTab({ report }: { report: Report }) {
  if (report.passed.length === 0) {
    return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">No rules passed on this page. (Older scans did not store passed rules.)</p>
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl font-semibold">Passed checks</h2>
        <p className="mt-1 text-muted-foreground">{report.passed.length} rules found nothing wrong on this page.</p>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {report.passed.map((p) => (
          <li key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/80 p-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-sev-minor" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">{p.help}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <code className="font-mono">{p.id}</code><span aria-hidden="true">·</span><span>{LEVEL_LABEL[p.level]}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
