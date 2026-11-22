/**
 * Splits a snippet so that every tag and every attribute sits on its own line. A one-line `<img src alt>` then
 * diffs as "+ alt=…" instead of "the whole line changed".
 */
export function formatHtml(html: string): string[] {
  const lines: string[] = []
  let depth = 0
  const parts = html.replace(/\s+/g, " ").trim().match(/<[^>]*>|[^<]+/g) ?? []
  const VOID = /^<(img|input|br|hr|meta|link|area|col|source|track|wbr)\b/i
  for (const part of parts) {
    if (!part.startsWith("<")) {
      const text = part.trim()
      if (text) lines.push("  ".repeat(depth) + text)
      continue
    }
    if (part.startsWith("</")) depth = Math.max(0, depth - 1)
    const pad = "  ".repeat(depth)
    const open = /^<([a-z][a-z0-9-]*)((?:\s+[^<>]*?)?)\s*(\/?)>$/i.exec(part)
    if (open && open[2]!.trim()) {
      const attrs = open[2]!.match(/[^\s=]+(?:=(?:"[^"]*"|'[^']*'|[^\s"']+))?/g) ?? []
      lines.push(`${pad}<${open[1]}`, ...attrs.map((a) => `${pad}  ${a}`), `${pad}${open[3] ? "/>" : ">"}`)
    } else {
      lines.push(pad + part)
    }
    if (open && !open[3] && !VOID.test(part)) depth++
  }
  return lines
}

export type DiffLine = { kind: "same" | "add" | "del"; text: string }

/** Classic LCS line diff (snippets are tiny, so O(n·m) is fine). */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length
  const m = after.length
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = before[i] === after[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ kind: "same", text: before[i]! })
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) out.push({ kind: "del", text: before[i++]! })
    else out.push({ kind: "add", text: after[j++]! })
  }
  while (i < n) out.push({ kind: "del", text: before[i++]! })
  while (j < m) out.push({ kind: "add", text: after[j++]! })
  return out
}
