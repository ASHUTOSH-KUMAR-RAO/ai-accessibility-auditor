import { useEffect, useState } from "react"
import { Gauge, FileSearch, Info, ShieldAlert, ShieldCheck, Sparkles, Wrench, Zap, Clock, Hourglass } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { minutesUntil, type AiFix, type Confidence, type Effort, type FallbackReason, type RateLimit, type VerificationStatus } from "@/lib/ai"
import { cn } from "@/lib/utils"

const CHIP = "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold"

/** A badge that explains itself: a real button so keyboard and touch users get the tooltip too. */
function ExplainedChip({ className, icon: Icon, label, tip }: { className: string; icon: typeof Info; label: string; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" className={cn(CHIP, "cursor-help", className)} />}>
        <Icon className="size-4" aria-hidden="true" />{label}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

const VERIFICATION: Record<VerificationStatus, { label: string; icon: typeof Info; className: string; tip: string }> = {
  VERIFIED: {
    label: "Verified fix",
    icon: ShieldCheck,
    className: "border-sev-minor/70 bg-sev-minor/12",
    tip: "We re-ran the axe-core check for this rule in an isolated, offline browser: it fails on your original code and passes on this fix.",
  },
  NOT_VERIFIED: {
    label: "Not verified",
    icon: ShieldAlert,
    className: "border-sev-critical/70 bg-sev-critical/12",
    tip: "We re-ran the axe-core check on this fix and it still reports the problem. Treat it as a starting point and check it yourself.",
  },
  NOT_APPLICABLE: {
    label: "Needs page context",
    icon: FileSearch,
    className: "border-border bg-muted",
    tip: "This rule depends on the whole page, so a lone snippet can't be re-checked automatically. Apply it and re-scan to confirm.",
  },
}

export function VerificationBadge({ status, note }: { status: VerificationStatus; note?: string }) {
  const v = VERIFICATION[status]
  return <ExplainedChip className={v.className} icon={v.icon} label={v.label} tip={note ? `${v.tip} ${status === "NOT_APPLICABLE" ? note : ""}`.trim() : v.tip} />
}

const CONFIDENCE: Record<Confidence, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" }
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <ExplainedChip
      className="border-border bg-card" icon={Gauge} label={CONFIDENCE[confidence]}
      tip="How sure the author of this fix is that it solves the problem without changing what the element does."
    />
  )
}

export function SourceBadge({ fix }: { fix: AiFix }) {
  return fix.source === "guided" ? (
    <ExplainedChip className="border-border bg-muted" icon={Wrench} label="Guided fix (no AI)" tip="Written from our built-in rules for this kind of issue, not by an AI model." />
  ) : (
    <ExplainedChip className="border-border bg-card" icon={Sparkles} label="AI fix" tip={`Written by an AI model${fix.model ? ` (${fix.model})` : ""} and checked automatically. Always review code before shipping it.`} />
  )
}

const EFFORT: Record<Effort, { label: string; icon: typeof Zap; tip: string }> = {
  quick: { label: "Quick", icon: Zap, tip: "Usually a few minutes." },
  medium: { label: "Medium", icon: Clock, tip: "Plan for an hour or so." },
  large: { label: "Large", icon: Hourglass, tip: "Needs design or development time." },
}
export function EffortChip({ effort }: { effort: Effort }) {
  const e = EFFORT[effort]
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-sm font-semibold" title={e.tip}>
      <e.icon className="size-4" aria-hidden="true" /><span className="sr-only">Effort: </span>{e.label}
    </span>
  )
}

/** Minutes left, re-rendered once a minute. */
function useMinutes(resetAt: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return minutesUntil(resetAt, now)
}

export function RateLimitNotice({ rateLimit, what = "fix" }: { rateLimit: RateLimit; what?: string }) {
  const minutes = useMinutes(rateLimit.resetAt)
  return (
    <p role="status" className="flex gap-2 rounded-xl border border-border bg-muted p-3 text-sm">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        You've used all {rateLimit.limit} AI generations for this hour{minutes ? <>, so new AI access returns in about <strong>{minutes} {minutes === 1 ? "minute" : "minutes"}</strong></> : null}. This {what} comes from our built-in rules instead.
      </span>
    </p>
  )
}

const HINT: Record<Exclude<FallbackReason, null | "rate_limited">, string> = {
  no_key: "AI isn't set up on this server, so you're seeing guided fixes.",
  limited: "AI is limited right now, showing guided fixes.",
  failed: "AI couldn't answer this time, so this is a guided fix. You can try again.",
}
export function DegradedHint({ reason }: { reason: FallbackReason }) {
  if (!reason || reason === "rate_limited") return null
  return (
    <p role="status" className="flex gap-2 rounded-xl border border-border bg-muted p-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{HINT[reason]}
    </p>
  )
}

export function Sparkle({ className }: { className?: string }) {
  return <Sparkles className={cn("ai-sparkle size-4", className)} aria-hidden="true" />
}
