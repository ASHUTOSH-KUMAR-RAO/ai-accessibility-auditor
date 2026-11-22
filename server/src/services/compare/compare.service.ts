import { createHash } from "node:crypto"
import { AppError } from "../../utils/AppError.js"
import { prisma } from "../prisma.js"

// Compares two scans of the same site. Issues are matched by a fingerprint that survives small page changes.

const norm = {
  /** Drop what changes between page loads (ids with digits, data-*, nonces, inline styles) and whitespace. */
  html: (html: string) =>
    html
      .toLowerCase()
      .replace(/\s(data-[\w-]+|nonce|style|class|id)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, "")
      .replace(/\d{4,}/g, "#")
      .replace(/\s+/g, " ")
      .trim(),
  /** Positional indices and generated ids make selectors brittle; keep the element path shape. */
  selector: (sel: string) => sel.replace(/:nth-(?:child|of-type)\(\d+\)/g, "").replace(/#[\w-]*\d{3,}[\w-]*/g, "#id").replace(/\s+/g, " ").trim(),
}
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12)

export interface IssueRef { id: string; ruleId: string; impact: string; help: string; selector: string; html: string }
interface Fp extends IssueRef { exact: string; byHtml: string; bySel: string; tokens: Set<string> }

const tokens = (html: string) => new Set(norm.html(html).split(/[\s<>="'/]+/).filter((t) => t.length > 1))
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export function fingerprint(i: IssueRef): Fp {
  const html = hash(norm.html(i.html))
  const sel = norm.selector(i.selector)
  return { ...i, exact: `${i.ruleId}|${sel}|${html}`, byHtml: `${i.ruleId}|${html}`, bySel: `${i.ruleId}|${sel}`, tokens: tokens(i.html) }
}

export const FUZZY_THRESHOLD = 0.75

export interface Matching {
  unchanged: Array<{ a: IssueRef; b: IssueRef; how: "exact" | "markup" | "selector" | "similar" }>
  fixed: IssueRef[]
  added: IssueRef[]
}

/**
 * Pass 1: same rule + selector + markup. Pass 2: same rule + markup (the element moved). Pass 3: same rule + selector
 * (its markup changed a little). Pass 4: same rule + similar markup (Jaccard >= 0.75). Leftovers: fixed (only in A) / new (only in B).
 */
export function matchIssues(before: IssueRef[], after: IssueRef[]): Matching {
  const A = before.map(fingerprint)
  const B = after.map(fingerprint)
  const usedB = new Set<number>()
  const matchedA = new Set<number>()
  const unchanged: Matching["unchanged"] = []

  const pass = (key: (f: Fp) => string, how: Matching["unchanged"][number]["how"]) => {
    const pool = new Map<string, number[]>()
    B.forEach((f, j) => {
      if (!usedB.has(j)) pool.set(key(f), [...(pool.get(key(f)) ?? []), j])
    })
    A.forEach((f, i) => {
      if (matchedA.has(i)) return
      const j = pool.get(key(f))?.shift()
      if (j === undefined) return
      usedB.add(j)
      matchedA.add(i)
      unchanged.push({ a: before[i]!, b: after[j]!, how })
    })
  }
  pass((f) => f.exact, "exact")
  pass((f) => f.byHtml, "markup")
  pass((f) => f.bySel, "selector")

  A.forEach((fa, i) => {
    if (matchedA.has(i)) return
    let best = -1
    let score = FUZZY_THRESHOLD
    B.forEach((fb, j) => {
      if (usedB.has(j) || fb.ruleId !== fa.ruleId) return
      const s = jaccard(fa.tokens, fb.tokens)
      if (s >= score) {
        score = s
        best = j
      }
    })
    if (best >= 0) {
      usedB.add(best)
      matchedA.add(i)
      unchanged.push({ a: before[i]!, b: after[best]!, how: "similar" })
    }
  })
  return { unchanged, fixed: before.filter((_, i) => !matchedA.has(i)), added: after.filter((_, j) => !usedB.has(j)) }
}

// ───────── service ─────────
type RuleRow = { id: string; impact: string; help: string; totalNodes: number }
const scanSelect = { id: true, url: true, finalUrl: true, host: true, status: true, score: true, viewport: true, createdAt: true, rules: true, criticalCount: true, seriousCount: true, moderateCount: true, minorCount: true } as const
const asRules = (v: unknown): RuleRow[] => (Array.isArray(v) ? (v as RuleRow[]) : [])
const IMPACT_RANK: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 }

async function load(userId: string, id: string) {
  const scan = await prisma.scan.findFirst({ where: { id, userId, deletedAt: null }, select: scanSelect })
  if (!scan) throw new AppError("Scan not found", 404, "NOT_FOUND")
  if (scan.status !== "COMPLETED") throw new AppError("Only finished scans can be compared.", 409, "NOT_COMPLETED")
  const issues = await prisma.issue.findMany({ where: { scanId: id }, select: { id: true, ruleId: true, impact: true, help: true, selector: true, html: true } })
  return { scan, issues: issues.map((i) => ({ ...i, impact: i.impact.toLowerCase() })) }
}

const cap = (xs: IssueRef[]) => xs.slice(0, 300).map(({ id, ruleId, impact, help, selector, html }) => ({ id, ruleId, impact, help, selector, html: html.slice(0, 400) }))

export async function compareScans(userId: string, aId: string, bId: string) {
  if (aId === bId) throw new AppError("Pick two different scans.", 400, "SAME_SCAN")
  const [a, b] = await Promise.all([load(userId, aId), load(userId, bId)])
  if (a.scan.host !== b.scan.host) throw new AppError("These scans are of different websites. Compare two scans of the same site.", 400, "DIFFERENT_SITES")
  // "before" is always the older scan, whatever order the URL had
  const [before, after] = a.scan.createdAt <= b.scan.createdAt ? [a, b] : [b, a]

  const m = matchIssues(before.issues, after.issues)
  const ra = new Map(asRules(before.scan.rules).map((r) => [r.id, r]))
  const rb = new Map(asRules(after.scan.rules).map((r) => [r.id, r]))
  const rules = [...new Set([...ra.keys(), ...rb.keys()])]
    .map((id) => {
      const x = ra.get(id)
      const y = rb.get(id)
      const status = !y ? "fixed" : !x ? "new" : y.totalNodes < x.totalNodes ? "improved" : y.totalNodes > x.totalNodes ? "worse" : "unchanged"
      return { ruleId: id, help: (y ?? x)!.help, impact: (y ?? x)!.impact, status, before: x?.totalNodes ?? 0, after: y?.totalNodes ?? 0 }
    })
    .sort((p, q) => (IMPACT_RANK[p.impact] ?? 9) - (IMPACT_RANK[q.impact] ?? 9) || q.after + q.before - (p.after + p.before))

  const summary = (s: typeof before.scan) => ({
    id: s.id,
    url: s.finalUrl ?? s.url,
    viewport: s.viewport,
    createdAt: s.createdAt,
    score: s.score ?? 0,
    counts: { critical: s.criticalCount, serious: s.seriousCount, moderate: s.moderateCount, minor: s.minorCount },
  })
  const sa = summary(before.scan)
  const sb = summary(after.scan)
  return {
    host: before.scan.host,
    before: sa,
    after: sb,
    scoreDelta: sb.score - sa.score,
    totals: { fixed: m.fixed.length, new: m.added.length, unchanged: m.unchanged.length },
    // Only a capped sample of elements per rule is stored, so element lists are a sample for very large rules.
    sampled: rules.some((r) => r.before > 50 || r.after > 50),
    rules,
    fixed: cap(m.fixed),
    new: cap(m.added),
    unchanged: cap(m.unchanged.map((u) => u.b)),
  }
}

// ───────── sites ─────────
export async function listSites(userId: string) {
  const rows = await prisma.scan.findMany({
    where: { userId, deletedAt: null, status: "COMPLETED", host: { not: "" } },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, host: true, score: true, createdAt: true, favicon: true, viewport: true },
  })
  const by = new Map<string, typeof rows>()
  for (const r of rows) by.set(r.host, [...(by.get(r.host) ?? []), r])
  return [...by].map(([host, scans]) => ({
    host,
    scanCount: scans.length,
    latest: { id: scans[0]!.id, score: scans[0]!.score ?? 0, createdAt: scans[0]!.createdAt, viewport: scans[0]!.viewport },
    previousScore: scans[1]?.score ?? null,
    favicon: scans.find((s) => s.favicon)?.favicon ?? null,
  }))
}

export async function getSite(userId: string, host: string) {
  const scans = await prisma.scan.findMany({
    where: { userId, deletedAt: null, status: "COMPLETED", host },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, score: true, createdAt: true, viewport: true, url: true, criticalCount: true, seriousCount: true, moderateCount: true, minorCount: true, favicon: true },
  })
  if (scans.length === 0) throw new AppError("Site not found", 404, "NOT_FOUND")
  const dto = ({ favicon: _f, ...s }: (typeof scans)[number]) => ({ ...s, score: s.score ?? 0 })
  return {
    host,
    favicon: [...scans].reverse().find((s) => s.favicon)?.favicon ?? null,
    scans: scans.map(dto),
    latest: dto(scans[scans.length - 1]!),
    previous: scans.length > 1 ? { id: scans[scans.length - 2]!.id } : null,
  }
}
