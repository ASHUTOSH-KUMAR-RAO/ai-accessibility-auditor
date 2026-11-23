import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, FileSearch, Globe, History, LayoutDashboard, LogOut, Menu, Plus, type LucideIcon } from "lucide-react"
import { Logo, LogoMark } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/context/auth-store"
import { useIsDesktop } from "@/lib/hooks"
import { useMotionScale } from "@/lib/motion"
import { APP_LINKS } from "@/lib/nav"
import { usePersistentFlag } from "@/lib/persist"
import { initials, useSignOut } from "@/lib/user"
import { cn } from "@/lib/utils"

const ICONS: Record<(typeof APP_LINKS)[number]["icon"], LucideIcon> = { dashboard: LayoutDashboard, history: History, globe: Globe, sample: FileSearch }

function Item({ to, label, icon: Icon, collapsed, onNavigate }: { to: string; label: string; icon: LucideIcon; collapsed: boolean; onNavigate?: () => void }) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors hover:bg-accent",
          collapsed && "justify-center px-0",
          isActive ? "bg-accent text-foreground shadow-[inset_3px_0_0_var(--primary)]" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
    </NavLink>
  )
  if (!collapsed) return <li>{link}</li>
  return (
    <li>
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </li>
  )
}

/** The same navigation in the desktop sidebar and the mobile drawer. */
function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user } = useAuth()
  const signOut = useSignOut()
  return (
    <>
      <NavLink to="/dashboard" onClick={onNavigate} className={cn(buttonVariants({ size: collapsed ? "icon" : "default" }), "mb-4", collapsed ? "self-center" : "w-full")}>
        <Plus aria-hidden="true" />
        <span className={collapsed ? "sr-only" : undefined}>New scan</span>
      </NavLink>
      <nav aria-label="App" className="flex-1">
        <ul className="space-y-1">
          {APP_LINKS.map((l) => (
            <Item key={l.to} to={l.to} label={l.label} icon={ICONS[l.icon]} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
      <div className={cn("mt-6 space-y-3", collapsed && "flex flex-col items-center")}>
        <ThemeToggle className={collapsed ? "flex-col" : undefined} />
        {user && (
          <div className={cn("flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-2.5", collapsed && "border-0 bg-transparent p-0")}>
            <Avatar className="size-10 shrink-0">
              <AvatarFallback data-initials={initials(user.name)} className="bg-foreground text-sm font-semibold text-background after:content-[attr(data-initials)]" />
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => { onNavigate?.(); void signOut() }} aria-label="Log out"><LogOut aria-hidden="true" /></Button>
          </div>
        )}
      </div>
    </>
  )
}

/** Signed-in layout: collapsible sidebar on desktop (state remembered), drawer on mobile. One logo per screen. */
export function AppShell() {
  const [collapsed, setCollapsed] = usePersistentFlag("accesslens:sidebar-collapsed")
  const [drawer, setDrawer] = useState(false)
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  const { distance, speed } = useMotionScale()

  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.getElementById("main")?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="skip-link">Skip to main content</a>

      {desktop && (
        <aside
          aria-label="Sidebar"
          className={cn("surface-textured sticky top-0 flex h-dvh shrink-0 flex-col bg-background/70 py-5 transition-[width] duration-300", collapsed ? "w-[4.75rem] px-3" : "w-64 px-4")}
        >
          <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between")}>{collapsed ? <LogoMark className="size-10" /> : <Logo />}</div>
          <NavContent collapsed={collapsed} />
          <Button
            variant="outline" size="icon-sm" onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-4 top-7 z-10 rounded-full bg-card shadow-soft"
          >
            {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
          </Button>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {!desktop && (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 bg-background px-4">
            <Logo />
            <Sheet open={drawer} onOpenChange={setDrawer}>
              <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open menu" />}><Menu aria-hidden="true" /></SheetTrigger>
              <SheetContent side="left" className="surface-textured w-[85vw] max-w-xs p-5">
                <SheetTitle className="font-display text-2xl">Menu</SheetTitle>
                <SheetDescription className="sr-only">App navigation</SheetDescription>
                <NavContent collapsed={false} onNavigate={() => setDrawer(false)} />
              </SheetContent>
            </Sheet>
          </header>
        )}
        <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
            transformTemplate={(_, t) => (/translateY\(0(px)?\)/.test(t) ? "none" : t)} // never leave a transform at rest: it would trap position: fixed descendants
              initial={{ opacity: 1, y: 18 * distance }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 * distance }}
              transition={{ duration: 0.35 * speed, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
