import { Link } from "react-router-dom"
import { Logo } from "@/components/brand/logo"
import { LEGAL_LINKS, PRODUCT_LINKS, type NavItem } from "@/lib/nav"

const YEAR = new Date().getFullYear()

function Column({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <ul className="mt-4 space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="inline-block rounded-md py-1.5 text-base text-foreground underline-offset-4 hover:text-link hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-background/60 backdrop-blur-sm">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-muted-foreground">
            Paste a URL. See what a screen reader, a keyboard and a colour-blind visitor see — then fix it with plain-language help.
          </p>
        </div>
        <Column title="Product" links={PRODUCT_LINKS} />
        <Column title="Legal" links={LEGAL_LINKS} />
      </div>
      <div className="border-t border-border/70">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {YEAR} AccessLens. All rights reserved.</p>
          <p>Made by Avishka</p>
        </div>
      </div>
    </footer>
  )
}
