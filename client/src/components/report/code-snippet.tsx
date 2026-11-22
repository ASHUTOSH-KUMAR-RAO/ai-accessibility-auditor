import { lazy, Suspense } from "react"
import { CopyButton } from "./copy-button"

// Prism (~12 kB) is only fetched when a snippet is first shown
const HighlightedCode = lazy(() => import("./highlighted-code"))

/** Syntax-highlighted, keyboard-scrollable HTML snippet with a copy button. */
export function CodeSnippet({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative">
      <pre
        tabIndex={0}
        role="group"
        aria-label={label}
        className="max-h-44 overflow-auto rounded-xl border border-border bg-(--code-bg) p-3 pr-12 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap break-all text-foreground"
      >
        <code>
          <Suspense fallback={code}><HighlightedCode code={code} /></Suspense>
        </code>
      </pre>
      <CopyButton text={code} label={`Copy ${label}`} className="absolute right-2 top-2" />
    </div>
  )
}
