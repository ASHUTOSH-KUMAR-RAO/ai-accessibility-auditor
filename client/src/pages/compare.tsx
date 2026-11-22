import { ArrowLeft, ArrowRight, CircleCheck, CirclePlus, Equal, GitCompareArrows, SearchX, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { SeverityBadge } from "@/components/brand/severity-badge"
import { CodeSnippet } from "@/components/report/code-snippet"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/lib/api"
import { useCompare, useSite, type Comparison, type IssueRef, type RuleStatus } from "@/lib/insights"
import { gradeFor } from "@/lib/scans"
import { cn } from "@/lib/utils"

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
const TAB = "h-12 flex-none cursor-pointer rounded-none border-b-4 border-transparent px-4 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary data-[active]:text-foreground"

const STATUS: Record<RuleStatus, { label: string; icon: LucideIcon }> = {
  fixed: { label: "Fixed", icon: CircleCheck },
  new: { label: "New", icon: CirclePlus },
  improved: { label: "Improved", icon: TrendingDown },
  worse: { label: "Worse", icon: TrendingUp },
  unchanged: { label: "Unchanged", icon: Equal },
}
function StatusChip({ status }: { status: RuleStatus }) {
  const { label, icon: Icon } = STATUS[status]
  return <span className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-background px-2.5 py-0.5 text-sm font-semibold"><Icon className="size-4" aria-hidden="true" />{label}</span>
}

function ScanCard({ title, s }: { title: string; s: Comparison["before"] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-sans text-sm font-semibold text-muted-foreground">{title}</h3>
      <p className="mt-1 flex items-baseline gap-2"><span className="font-display text-5xl font-semibold tabular-nums">{s.score}</span><span className="font-semibold">Grade {gradeFor(s.score)}</span></p>
      <p className="mt-1 text-sm text-muted-foreground"><time dateTime={s.createdAt}>{dateFmt.format(new Date(s.createdAt))}</time> · {s.viewport === "MOBILE" ? "Mobile" : "Desktop"}</p>
      <Link to={`/scans/${s.id}`} className="mt-2 inline-block font-medium text-link underline underline-offset-4">Open report<span className="sr-only"> from {dateFmt.format(new Date(s.createdAt))}</span></Link>
    </div>
  )
}

function IssueList({ items, status, empty }: { items: IssueRef[]; status: RuleStatus; empty: string }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2"><StatusChip status={status} /><SeverityBadge severity={i.impact} /><span className="font-semibold">{i.help}</span></div>
          <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">{i.selector}</code>
          <CodeSnippet code={i.html} label={`HTML of an element with ${i.ruleId}`} />
        </li>
      ))}
    </ul>
  )
}

function Result({ c, a, b }: { c: Comparison; a: string; b: string }) {
  const site = useSite(c.host)
  const [, setParams] = useSearchParams()
  const scans = site.data?.scans ?? []
  const pick = (key: "a" | "b", id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(key, id); return n }, { replace: true })
  const label = (s: { createdAt: string; score: number; viewport: string }) => `${dateFmt.format(new Date(s.createdAt))} · score ${s.score} · ${s.viewport === "MOBILE" ? "mobile" : "desktop"}`
  void a; void b
  const improved = c.scoreDelta > 0
  const Trend = c.scoreDelta > 0 ? TrendingUp : c.scoreDelta < 0 ? TrendingDown : Equal

  return (
    <div className="space-y-8">
      {scans.length > 1 && (
        <form className="grid gap-4 rounded-2xl border border-border bg-card/90 p-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          {([["a", "Scan A", a], ["b", "Scan B", b]] as const).map(([k, name, value]) => (
            <div key={k}>
              <label htmlFor={`cmp-${k}`} className="mb-1.5 block text-sm font-semibold">{name}</label>
              <select id={`cmp-${k}`} value={value} onChange={(e) => pick(k, e.target.value)} className="h-11 w-full cursor-pointer rounded-xl border-2 border-input bg-card px-3 text-base">
                {scans.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
              </select>
            </div>
          ))}
        </form>
      )}

      <section aria-labelledby="cmp-score" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-8">
        <h2 id="cmp-score" className="sr-only">Score change</h2>
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <ScanCard title="Before (older scan)" s={c.before} />
          <div className="flex flex-col items-center gap-2 text-center">
            <ArrowRight className="hidden size-6 md:block" aria-hidden="true" />
            <p className="font-display text-4xl font-semibold tabular-nums">{c.scoreDelta > 0 ? "+" : ""}{c.scoreDelta}</p>
            <p className="inline-flex items-center gap-1.5 font-semibold"><Trend className="size-5" aria-hidden="true" />{improved ? "Improved" : c.scoreDelta < 0 ? "Got worse" : "No change"}</p>
          </div>
          <ScanCard title="After (newer scan)" s={c.after} />
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Issue changes">
          {([["fixed", c.totals.fixed], ["new", c.totals.new], ["unchanged", c.totals.unchanged]] as const).map(([k, n]) => {
            const { icon: Icon, label } = STATUS[k]
            return (
              <li key={k} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-background p-4">
                <Icon className="size-7 shrink-0" aria-hidden="true" />
                <div><p className="font-display text-3xl font-semibold tabular-nums">{n}</p><p className="font-semibold">{k === "unchanged" ? "Still present" : label}</p></div>
              </li>
            )
          })}
        </ul>
        {c.sampled && <p className="mt-4 text-sm text-muted-foreground">Elements are compared from the saved sample (up to 50 per rule). The rule totals below count every element.</p>}
      </section>

      <Tabs defaultValue="rules" className="gap-6">
        <TabsList variant="line" aria-label="Comparison details" className="h-auto w-full justify-start overflow-x-auto border-b border-border p-0">
          <TabsTrigger value="rules" className={TAB}>By rule</TabsTrigger>
          <TabsTrigger value="fixed" className={TAB}>Fixed <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{c.totals.fixed}</span></TabsTrigger>
          <TabsTrigger value="new" className={TAB}>New <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{c.totals.new}</span></TabsTrigger>
          <TabsTrigger value="unchanged" className={TAB}>Still present <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums">{c.totals.unchanged}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="rules">
          <div tabIndex={0} role="region" aria-label="Rules compared between the two scans, scrolls sideways on small screens" className="relative overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">Rules compared between the two scans: elements affected before and after</caption>
              <thead><tr className="border-b-2 border-border bg-muted/60"><th scope="col" className="p-3">Rule</th><th scope="col" className="p-3">Severity</th><th scope="col" className="p-3 text-right">Before</th><th scope="col" className="p-3 text-right">After</th><th scope="col" className="p-3">Change</th></tr></thead>
              <tbody>
                {c.rules.map((r) => (
                  <tr key={r.ruleId} className={cn("border-b border-border", r.status === "unchanged" && "text-muted-foreground")}>
                    <th scope="row" className="p-3 font-semibold">{r.help}</th>
                    <td className="p-3"><SeverityBadge severity={r.impact} /></td>
                    <td className="p-3 text-right tabular-nums">{r.before}</td>
                    <td className="p-3 text-right tabular-nums">{r.after}</td>
                    <td className="p-3"><StatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="fixed"><IssueList items={c.fixed} status="fixed" empty="Nothing was fixed between these scans." /></TabsContent>
        <TabsContent value="new"><IssueList items={c.new} status="new" empty="No new problems appeared. Nice." /></TabsContent>
        <TabsContent value="unchanged"><IssueList items={c.unchanged} status="unchanged" empty="No problem from the older scan is still present." /></TabsContent>
      </Tabs>
    </div>
  )
}

export default function ComparePage() {
  const [params] = useSearchParams()
  const a = params.get("a") ?? ""
  const b = params.get("b") ?? ""
  const q = useCompare(a, b)
  const missing = !a || !b

  return (
    <section className="container-page max-w-[92rem] py-10 sm:py-14">
      <Link to="/sites" className="mb-6 inline-flex items-center gap-2 rounded-lg py-1 font-medium text-link underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />My sites</Link>
      <h1 className="flex flex-wrap items-center gap-3 font-display text-4xl font-semibold sm:text-5xl"><GitCompareArrows className="size-9" aria-hidden="true" />Compare scans{q.data && <span className="text-muted-foreground">of {q.data.host}</span>}</h1>
      <div className="mt-8">
        {missing && (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="text-lg">Choose two scans of the same site to compare.</p>
            <Link to="/sites" className={`${buttonVariants()} mt-5`}>Pick a site</Link>
          </div>
        )}
        {!missing && q.isPending && <div role="status"><span className="sr-only">Comparing scans…</span><Skeleton className="h-64 w-full rounded-3xl" /></div>}
        {!missing && q.isError && (
          <div role="alert" className="mx-auto max-w-lg py-12 text-center">
            <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-display text-3xl font-semibold">Can't compare these scans</h2>
            <p className="mt-2 text-muted-foreground">{q.error instanceof ApiError ? q.error.message : "Something went wrong."}</p>
            <Link to="/sites" className={`${buttonVariants()} mt-6`}>Back to my sites</Link>
          </div>
        )}
        {q.data && <Result c={q.data} a={a} b={b} />}
      </div>
    </section>
  )
}
