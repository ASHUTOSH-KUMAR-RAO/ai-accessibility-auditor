import { ExternalLink } from "lucide-react"
import { AUDIENCES, LEVEL_LABEL, PRINCIPLE_LABEL, type Audience, type Criterion, type PrincipleOrOther, type RuleLevel } from "@/lib/report"

/** WCAG success-criteria chips: each links to the W3C "Understanding" page. */
export function CriteriaChips({ criteria }: { criteria: Criterion[] }) {
  if (criteria.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="WCAG success criteria">
      {criteria.map((c) => (
        <li key={c.id}>
          <a
            href={c.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span className="font-semibold tabular-nums">{c.id}</span>{c.name}
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function LevelChips({ level, principle }: { level: RuleLevel; principle: PrincipleOrOther | null }) {
  return (
    <>
      <span className="rounded-full bg-muted px-2.5 py-1 text-sm font-medium">{LEVEL_LABEL[level]}</span>
      {principle && <span className="rounded-full bg-muted px-2.5 py-1 text-sm font-medium">{PRINCIPLE_LABEL[principle]}</span>}
    </>
  )
}

/** Who is affected: icon + words (never an icon alone). */
export function WhoAffected({ audiences }: { audiences: Audience[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">Who is affected</h4>
      <ul className="mt-2 flex flex-wrap gap-2">
        {audiences.map((a) => {
          const { label, icon: Icon } = AUDIENCES[a]
          return (
            <li key={a} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-sm">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />{label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
