import { useState } from "react"
import { Link, NavLink } from "react-router-dom"
import { History, LayoutDashboard, LogOut, Menu, Globe } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-store"
import { AUTH_LINKS, PRODUCT_LINKS } from "@/lib/nav"
import { initials, useSignOut } from "@/lib/user"
import { cn } from "@/lib/utils"

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent",
    isActive ? "text-foreground underline decoration-primary decoration-[3px] underline-offset-8" : "text-muted-foreground hover:text-foreground",
  )

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, status } = useAuth()
  const signOut = useSignOut()
  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-3">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {PRODUCT_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLink}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <div className="hidden items-center gap-2 md:flex">
            {status === "loading" && <Skeleton className="h-10 w-28 rounded-xl" aria-hidden="true" />}
            {status === "authenticated" && user && <UserMenu user={user} />}
            {status === "anonymous" && (
              <>
                <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Log in</Link>
                <Link to="/signup" className={buttonVariants({ size: "sm" })}>Sign up</Link>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu" />}>
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-6">
              <SheetTitle className="font-display text-2xl">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>

              {user && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <Avatar className="size-11"><AvatarFallback aria-hidden="true" className="bg-foreground font-semibold text-background">{initials(user.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}

              <nav aria-label="Mobile" className="mt-2 flex flex-col gap-1">
                {user && (
                  <NavLink to="/dashboard" onClick={close} className={(s) => cn(navLink(s), "flex items-center gap-2 py-3 text-lg")}>
                    <LayoutDashboard className="size-5" aria-hidden="true" />Dashboard
                  </NavLink>
                )}
                {user && (
                  <NavLink to="/scans" end onClick={close} className={(s) => cn(navLink(s), "flex items-center gap-2 py-3 text-lg")}>
                    <History className="size-5" aria-hidden="true" />All scans
                  </NavLink>
                )}
                {user && (
                  <NavLink to="/sites" onClick={close} className={(s) => cn(navLink(s), "flex items-center gap-2 py-3 text-lg")}>
                    <Globe className="size-5" aria-hidden="true" />My sites
                  </NavLink>
                )}
                {PRODUCT_LINKS.map((l) => (
                  <NavLink key={l.to} to={l.to} onClick={close} className={(s) => cn(navLink(s), "py-3 text-lg")}>{l.label}</NavLink>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3">
                {user ? (
                  <Button variant="outline" size="lg" onClick={() => { close(); void signOut() }}><LogOut aria-hidden="true" />Log out</Button>
                ) : (
                  AUTH_LINKS.map((l, i) => (
                    <Link key={l.to} to={l.to} onClick={close} className={buttonVariants({ variant: i ? "default" : "outline", size: "lg" })}>{l.label}</Link>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
