import { Outlet } from "react-router-dom"
import { Logo } from "@/components/brand/logo"
import { BrailleText } from "@/components/brand/braille-text"
import { HeroReportCard } from "@/components/hero-report-card"
import { ThemeToggle } from "@/components/theme-toggle"

/** Auth pages have no site header: one logo, one theme toggle, split layout on desktop. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <a href="#main" className="skip-link">Skip to form</a>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12 lg:pt-9">
        <Logo />
        <ThemeToggle />
      </header>

      {/* Decorative showcase — hidden from assistive tech, desktop only */}
      <aside aria-hidden="true" className="relative hidden flex-col justify-center gap-12 overflow-hidden border-r border-border/70 px-12 py-28 lg:flex">
        <div className="max-w-md">
          <BrailleText text="see" />
          <p className="mt-6 font-display text-5xl font-semibold leading-[1.05]">
            Every page, readable by <span className="italic">everyone.</span>
          </p>
          <p className="mt-4 text-lg text-muted-foreground">Scan, understand and fix accessibility problems in minutes.</p>
        </div>
        <HeroReportCard />
      </aside>

      <main id="main" tabIndex={-1} className="flex flex-col justify-center px-5 pb-12 pt-28 outline-none sm:px-8 lg:px-16 lg:pt-12">
        <Outlet />
      </main>
    </div>
  )
}

