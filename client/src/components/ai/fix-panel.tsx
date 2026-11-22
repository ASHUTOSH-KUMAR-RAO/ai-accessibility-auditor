import { Fragment, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Ear, Eye, Keyboard, Loader2, Palette, RotateCw, Square, TriangleAlert, type LucideIcon } from "lucide-react"
import { CriteriaChips } from "@/components/report/wcag-chips"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAiFix, type AiFix, type FixState } from "@/lib/ai"
import { useIsDesktop } from "@/lib/hooks"
import { useMotionScale } from "@/lib/motion"
import { useRuleNodes, type Report } from "@/lib/report"
import { useReportSource } from "@/lib/report-source"
import { linkify } from "@/lib/safe-text"
import { cn } from "@/lib/utils"
import { ConfidenceBadge, DegradedHint, RateLimitNotice, Sparkle, SourceBadge, VerificationBadge } from "./ai-badges"
import { ContrastCard } from "./contrast-card"
import { CodeBlock, CodeDiff } from "./diff-view"
import { FixFeedback } from "./fix-feedback"

export interface FixTarget { ruleId: string; nodeId: string | null }

const TAB = "h-11 flex-1 cursor-pointer rounded-none border-b-4 border-transparent px-2 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary data-[active]:text-foreground"
const animated = new Set<string>() // fixes whose explanation has already been "typed" once

/** AI text as React text nodes. Links work only for w3.org / deque.com: everything else stays plain text. Never HTML. */
function SafeText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((s, i) =>
        s.type === "link" ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline underline-offset-4">{s.text}<span className="sr-only"> (opens in a new tab)</span></a>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

/** Reveals text word by word. Reduced-motion users get the same effect, just quicker and calmer. */
function useTypewriter(text: string, enabled: boolean, fast: boolean) {
  const words = useMemo(() => text.split(/(\s+)/), [text])
  const [count, setCount] = useState(enabled ? 0 : words.length)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setCount((c) => (c >= words.length ? c : c + 2)), fast ? 18 : 32)
    return () => clearInterval(id)
  }, [enabled, words.length, fast])
  return enabled ? words.slice(0, count).join("") : text
}

function Explanation({ fix, streamed }: { fix: AiFix; streamed: boolean }) {
  const { reduced } = useMotionScale()
  const type = !streamed && !fix.cached && !animated.has(fix.id)
  const shown = useTypewriter(fix.content.explanation, type, reduced)
  useEffect(() => void animated.add(fix.id), [fix.id])
  const typing = shown.length < fix.content.explanation.length
  return (
    <p className="text-lg leading-relaxed">
      <span aria-hidden="true"><SafeText text={shown} />{typing && <span className="ai-caret" />}</span>
      <span className="sr-only">{fix.content.explanation}</span>
    </p>
  )
}

const METHOD: Record<string, { label: string; icon: LucideIcon }> = {
  keyboard: { label: "Keyboard", icon: Keyboard },
  "screen-reader": { label: "Screen reader", icon: Ear },
  contrast: { label: "Contrast check", icon: Palette },
  visual: { label: "Visual check", icon: Eye },
}

function CodeSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="ai-shimmer h-5 w-1/3 rounded-md" /><Skeleton className="ai-shimmer h-28 w-full rounded-xl" />
      <Skeleton className="ai-shimmer h-5 w-1/4 rounded-md" /><Skeleton className="ai-shimmer h-28 w-full rounded-xl" />
    </div>
  )
}

function FixTab({ fix, before }: { fix: AiFix; before: string }) {
  const [lang, setLang] = useState<"html" | "react">("html")
  const { content } = fix
  const changed = content.fixedHtml !== null && content.fixedHtml.replace(/\s+/g, " ").trim() !== fix.original.replace(/\s+/g, " ").trim()
  return (
    <div className="space-y-5">
      <section aria-labelledby="how-to-fix">
        <h3 id="how-to-fix" className="mb-2 text-base font-semibold">How to fix</h3>
        <ol className="list-decimal space-y-1.5 pl-6 marker:font-semibold">{content.steps.map((s) => <li key={s}><SafeText text={s} /></li>)}</ol>
      </section>

      <div role="group" aria-label="Code language" className="inline-flex rounded-xl border-2 border-input p-0.5">
        {(["html", "react"] as const).map((l) => (
          <button
            key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
            className={cn("min-h-10 rounded-lg px-4 text-base font-semibold", lang === l ? "bg-foreground text-background" : "text-foreground hover:bg-accent")}
          >
            {l === "html" ? "HTML" : "React"}
          </button>
        ))}
      </div>

      {lang === "html" ? (
        content.fixedHtml === null ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">There is no automatic code change for this rule. Follow the steps above.</p>
        ) : changed ? (
          <CodeDiff before={fix.original} after={content.fixedHtml} />
        ) : (
          <p className="rounded-xl border border-border bg-muted p-3 text-sm">The HTML stays the same: the fix is in your CSS (below).</p>
        )
      ) : content.jsx ? (
        <CodeBlock title="Fixed React (JSX)" code={content.jsx} lang="jsx" copyLabel="Copy fixed JSX" />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">No React version for this fix: use the HTML version and adapt attribute names (class → className, for → htmlFor).</p>
      )}

      {content.cssFix && <CodeBlock title="CSS" code={content.cssFix} lang="css" copyLabel="Copy CSS" />}
      {lang === "html" && changed && before !== fix.original && (
        <p className="text-sm text-muted-foreground">Scripts, event handlers and very long values are removed before the AI sees your code, so they appear in neither column. Keep yours when you apply the fix.</p>
      )}
    </div>
  )
}

function TestTab({ fix }: { fix: AiFix }) {
  return (
    <section aria-labelledby="how-to-test" className="space-y-3">
      <h3 id="how-to-test" className="text-base font-semibold">How to test the fix</h3>
      <ul className="space-y-3">
        {fix.content.test.map((t) => {
          const m = METHOD[t.method] ?? METHOD.visual!
          return (
            <li key={t.text} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              <m.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div><p className="text-sm font-semibold">{m.label}</p><p><SafeText text={t.text} /></p></div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function announce(state: FixState) {
  if (state.status === "loading") return "Writing the fix…"
  if (state.status === "done") return `${state.fix.source === "ai" ? "AI fix" : "Guided fix"} ready. ${state.fix.content.explanation}`
  if (state.status === "error") return state.message
  if (state.status === "cancelled") return "Cancelled."
  return ""
}

function Body({ report, target, onTarget }: { report: Report; target: FixTarget; onTarget: (t: FixTarget) => void }) {
  const scanId = report.scan.id
  const rule = report.rules.find((r) => r.id === target.ruleId)!
  const q = useRuleNodes(scanId, rule.id, true)
  const nodes = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])
  const index = Math.max(0, target.nodeId ? nodes.findIndex((n) => n.id === target.nodeId) : 0)
  const node = nodes[index]
  const { state, run, cancel } = useAiFix(scanId, node?.id ?? null)
  const announcement = announce(state)
  const { readOnly } = useReportSource()
  const total = q.hasNextPage ? `${nodes.length}+` : String(nodes.length)

  const go = async (delta: -1 | 1) => {
    let list = nodes
    if (delta === 1 && index === nodes.length - 1 && q.hasNextPage) list = (await q.fetchNextPage()).data?.pages.flatMap((p) => p.items) ?? nodes
    const next = list[index + delta]
    if (next) onTarget({ ruleId: rule.id, nodeId: next.id })
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b border-border p-4 pr-14 sm:p-5 sm:pr-16">
        <p className="eyebrow flex items-center gap-1.5"><Sparkle />AI fix</p>
        <SheetTitle className="font-display text-2xl leading-tight">{rule.help}</SheetTitle>
        <SheetDescription className="sr-only">Explanation, fixed code and test steps for one affected element. Use Previous and Next to move between this rule's elements.</SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void go(-1)} disabled={index === 0 || !node} aria-label="Previous element"><ChevronLeft aria-hidden="true" />Previous</Button>
          <span className="text-sm font-semibold tabular-nums" aria-live="off">Element {node ? index + 1 : "…"} of {total}</span>
          <Button variant="outline" size="sm" onClick={() => void go(1)} disabled={!node || (index >= nodes.length - 1 && !q.hasNextPage) || q.isFetchingNextPage} aria-label="Next element">Next<ChevronRight aria-hidden="true" /></Button>
        </div>
        {node && <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">{node.selector}</code>}
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <p role="status" className="sr-only">{announcement}</p>

        {(q.isPending || (q.isFetching && !node)) && <CodeSkeleton label="Loading the element…" />}
        {q.isError && <ErrorBox message="Couldn't load this element." onRetry={() => void q.refetch()} />}

        {state.status === "done" && (
          <div className="flex flex-wrap items-center gap-2" aria-label="About this fix" role="group">
            <SourceBadge fix={state.fix} />
            <VerificationBadge status={state.fix.verification.status} note={state.fix.verification.note} />
            <ConfidenceBadge confidence={state.fix.content.confidence} />
            {state.fix.cached && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium">Saved result</span>}
          </div>
        )}
        {state.status === "done" && state.fix.rateLimit && <RateLimitNotice rateLimit={state.fix.rateLimit} />}
        {state.status === "done" && <DegradedHint reason={state.fix.fallbackReason} />}

        {state.status === "error" && <ErrorBox message={state.message} onRetry={run} />}
        {state.status === "cancelled" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted p-3">
            <p className="flex-1">Cancelled. Nothing was used from your AI budget.</p>
            <Button variant="outline" size="sm" onClick={run}><RotateCw aria-hidden="true" />Write the fix</Button>
          </div>
        )}

        {(state.status === "loading" || state.status === "done") && node && (
          <Tabs key={node.id} defaultValue="explanation" className="gap-5">
            <TabsList variant="line" aria-label="Fix sections" className="h-auto w-full border-b border-border p-0">
              <TabsTrigger value="explanation" className={TAB}>Explanation</TabsTrigger>
              <TabsTrigger value="fix" className={TAB}>Fix</TabsTrigger>
              <TabsTrigger value="test" className={TAB}>How to test</TabsTrigger>
            </TabsList>

            <TabsContent value="explanation" className="space-y-5">
              {state.status === "loading" ? (
                <div className="space-y-4">
                  <p className="text-lg leading-relaxed">
                    <span aria-hidden="true">
                      {state.text ? <SafeText text={state.text} /> : <span className="text-muted-foreground">{state.generating ? "Reading the element…" : "Checking for a saved answer…"}</span>}
                      <span className="ai-caret" />
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /><span className="text-sm text-muted-foreground">Writing and checking the fix…</span>
                    <Button variant="outline" size="sm" onClick={cancel}><Square aria-hidden="true" />Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Explanation fix={state.fix} streamed={state.streamed} />
                  {state.fix.criteria.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Related WCAG criteria</h3><CriteriaChips criteria={state.fix.criteria} /></div>}
                  {state.fix.contrast && <ContrastCard info={state.fix.contrast} />}
                  <p className="text-sm text-muted-foreground">{state.fix.verification.note}</p>
                </>
              )}
            </TabsContent>
            <TabsContent value="fix">{state.status === "loading" ? <CodeSkeleton label="The fixed code is being written…" /> : <FixTab fix={state.fix} before={node.html} />}</TabsContent>
            <TabsContent value="test">{state.status === "loading" ? <CodeSkeleton label="Test steps are being written…" /> : <TestTab fix={state.fix} />}</TabsContent>
          </Tabs>
        )}

        {state.status === "done" && !readOnly && <FixFeedback key={state.fix.id} fixId={state.fix.id} />}
      </div>
    </>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">
      <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-semibold">{message}</p>
      <Button variant="outline" size="sm" className="border-critical/50 text-critical" onClick={onRetry}><RotateCw aria-hidden="true" />Try again</Button>
    </div>
  )
}

/** Side panel on desktop, bottom sheet on mobile. The sheet traps focus, closes on Escape and hands focus back to the button that opened it. */
export function FixPanel({ report, target, onTarget, onClose }: { report: Report; target: FixTarget | null; onTarget: (t: FixTarget) => void; onClose: () => void }) {
  const isDesktop = useIsDesktop()
  const known = target && report.rules.some((r) => r.id === target.ruleId)
  return (
    <Sheet open={!!known} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"} showCloseButton={false} aria-describedby={undefined}
        className="gap-0 p-0 data-[side=bottom]:h-[92dvh] data-[side=bottom]:rounded-t-3xl data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-none data-[side=right]:sm:w-[34rem] data-[side=right]:xl:w-[40rem]"
      >
        {known && <Body key={target.ruleId} report={report} target={target} onTarget={onTarget} />}
        <Button variant="outline" size="sm" className="absolute right-3 top-3" onClick={onClose}>Close<span className="sr-only"> AI fix panel</span></Button>
      </SheetContent>
    </Sheet>
  )
}
