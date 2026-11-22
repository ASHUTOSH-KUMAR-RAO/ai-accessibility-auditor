import { Link } from "react-router-dom"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { LEGAL_LINKS, PRODUCT_LINKS, type NavItem } from "@/lib/nav"

function Column({ title, links, columns = 1 }: { title: string; links: NavItem[]; columns?: 1 | 2 }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <ul className={columns === 2 ? "mt-4 grid grid-cols-1 gap-x-8 lg:grid-cols-2" : "mt-4"}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="inline-block rounded-md py-2 text-base text-foreground underline-offset-4 hover:text-link hover:underline">{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** No bands or borders: the Braille texture runs straight through. Brand left, links spread over the rest of the width. */
export function SiteFooter() {
  return (
    <footer className="container-page pb-8 pt-12">
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.3fr_1.2fr_0.8fr] lg:gap-x-16">
        <div className="col-span-2 max-w-sm space-y-4 lg:col-span-1">
          <Logo />
          <p className="text-muted-foreground">Paste a URL. See what a screen reader, a keyboard and a colour-blind visitor see, then fix it with plain-language help.</p>
        </div>
        <Column title="Product" links={PRODUCT_LINKS} columns={2} />
        <Column title="Legal" links={LEGAL_LINKS} />
      </div>
      <div className="mt-12 flex items-center justify-between gap-4">
        <p className="text-base font-medium">Made by Avishka</p>
        <ThemeToggle />
      </div>
    </footer>
  )
}
