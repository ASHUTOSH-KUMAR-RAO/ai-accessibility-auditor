import type { ReactNode } from "react"
import Prism from "prismjs"

Prism.manual = true // never scan the page, we only tokenize strings we are given

type Piece = string | Prism.Token

/**
 * Tokens → React elements. The scanned page's HTML is untrusted, so it is rendered strictly as text nodes:
 * there is no innerHTML / dangerouslySetInnerHTML anywhere on this path.
 */
function render(pieces: Piece[], keyPrefix = "t"): ReactNode[] {
  return pieces.map((p, i) => {
    if (typeof p === "string") return p
    const inner = Array.isArray(p.content) ? render(p.content, `${keyPrefix}${i}`) : typeof p.content === "string" ? p.content : render([p.content], `${keyPrefix}${i}`)
    return <span key={`${keyPrefix}${i}`} className={`tok-${p.type}`}>{inner}</span>
  })
}

export default function HighlightedCode({ code }: { code: string }) {
  return <>{render(Prism.tokenize(code, Prism.languages.markup!))}</>
}
