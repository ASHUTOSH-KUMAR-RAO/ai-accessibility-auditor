import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { BrailleText } from "@/components/brand/braille-text"
import { Reveal } from "@/components/landing/reveal"
import { LEGAL_LINKS } from "@/lib/nav"
import { useSeo } from "@/lib/seo"

export const LAST_UPDATED = "23 November 2026"

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 font-display text-3xl font-semibold">{children}</h2>
}

/** Readable long-form layout shared by the legal pages. */
export function LegalPage({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  useSeo({ title, description, path })
  return (
    <article className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <BrailleText text="legal" />
          <h1 className="mt-5 text-5xl font-semibold sm:text-6xl">{title}</h1>
          <p className="mt-3 text-muted-foreground">Last updated <time dateTime="2026-11-23">{LAST_UPDATED}</time></p>
          <p className="mt-6 rounded-2xl border-2 border-border bg-card/90 p-4">
            <strong>Portfolio project.</strong> AccessLens is a portfolio project, not a commercial service. It is provided as is, may change or go offline, and nothing here is legal advice.
          </p>
        </Reveal>
        <div className="mt-6 space-y-4 text-lg leading-relaxed [&_li]:my-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:font-medium [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4">{children}</div>
        <nav aria-label="Other legal pages" className="mt-14 flex flex-wrap gap-x-6 gap-y-2 text-base">
          {LEGAL_LINKS.filter((l) => l.to !== path).map((l) => <Link key={l.to} to={l.to} className="font-medium text-link underline underline-offset-4">{l.label}</Link>)}
        </nav>
      </div>
    </article>
  )
}
