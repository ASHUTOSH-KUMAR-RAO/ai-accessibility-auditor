import type { ReactNode } from "react"
import Prism from "prismjs"
import "prismjs/components/prism-css"
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-jsx"

Prism.manual = true // never scan the page, we only tokenize strings we are given
type Piece = string | Prism.Token

type Lang = "markup" | "css" | "jsx"
interface Leaf { text: string; type: string | null }

function flatten(pieces: Piece[], type: string | null = null): Leaf[] {
  return pieces.flatMap((p) => {
    if (typeof p === "string") return [{ text: p, type }]
    const inner = Array.isArray(p.content) ? p.content : [p.content]
    return flatten(inner as Piece[], p.type)
  })
}

/** Highlights a whole block, then returns it line by line (so a diff can wrap each line). Text nodes only, like above. */
export function highlightLines(code: string, lang: Lang = "markup"): ReactNode[] {
  const lines: Leaf[][] = [[]]
  for (const leaf of flatten(Prism.tokenize(code, Prism.languages[lang]!))) {
    leaf.text.split("\n").forEach((chunk, i) => {
      if (i > 0) lines.push([])
      if (chunk) lines[lines.length - 1]!.push({ text: chunk, type: leaf.type })
    })
  }
  return lines.map((leaves, li) => (
    <>{leaves.map((l, i) => (l.type ? <span key={`${li}-${i}`} className={`tok-${l.type}`}>{l.text}</span> : l.text))}</>
  ))
}
