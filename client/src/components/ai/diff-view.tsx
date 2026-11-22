import { useMemo } from "react"
import { CopyButton } from "@/components/report/copy-button"
import { highlightLines } from "@/components/report/highlight-lines"
import { diffLines, formatHtml, type DiffLine } from "@/lib/diff"

type Lang = "markup" | "css" | "jsx"

/** One block of code. Changed lines carry a +/− marker, a spoken label and a tinted background: colour is never the only cue. */
function Block({ title, lines, lang, copy, copyLabel }: { title: string; lines: DiffLine[]; lang: Lang; copy?: string; copyLabel?: string }) {
  const code = lines.map((l) => l.text).join("\n")
  const rendered = useMemo(() => highlightLines(code, lang), [code, lang])
  return (
    <figure className="space-y-1.5">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {copy !== undefined && <CopyButton text={copy} label={copyLabel ?? `Copy ${title.toLowerCase()}`} />}
      </figcaption>
      <pre tabIndex={0} role="group" aria-label={title} className="max-h-72 overflow-auto rounded-xl border border-border bg-(--code-bg) py-2 font-mono text-[0.8rem] leading-relaxed text-foreground">
        <code className="block min-w-max">
          {lines.map((l, i) => (
            <span key={i} className="diff-line" data-kind={l.kind}>
              <span className="diff-mark" aria-hidden="true">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
              <span className="whitespace-pre pr-3">
                {l.kind !== "same" && <span className="sr-only">{l.kind === "add" ? "Added: " : "Removed: "}</span>}
                {rendered[i] ?? l.text}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}

/** Before / after of one element, aligned attribute by attribute. */
export function CodeDiff({ before, after }: { before: string; after: string }) {
  const diff = useMemo(() => diffLines(formatHtml(before), formatHtml(after)), [before, after])
  const removed = diff.filter((l) => l.kind === "del").length
  const added = diff.filter((l) => l.kind === "add").length
  const beforeLines = diff.filter((l) => l.kind !== "add")
  const afterLines = diff.filter((l) => l.kind !== "del")
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" role="status">{added} {added === 1 ? "line" : "lines"} added, {removed} {removed === 1 ? "line" : "lines"} removed</p>
      <Block title="Before" lines={beforeLines} lang="markup" />
      <Block title="After" lines={afterLines} lang="markup" copy={after} copyLabel="Copy fixed HTML" />
    </div>
  )
}

/** A plain code block (CSS, JSX) with the same chrome, no diff. */
export function CodeBlock({ title, code, lang, copyLabel }: { title: string; code: string; lang: Lang; copyLabel?: string }) {
  const lines = useMemo<DiffLine[]>(() => code.split("\n").map((text) => ({ kind: "same", text })), [code])
  return <Block title={title} lines={lines} lang={lang} copy={code} copyLabel={copyLabel} />
}
