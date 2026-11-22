import { useState } from "react"
import { Link, NavLink } from "react-router-dom"
import { LayoutDashboard, LogOut, Menu } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { UserMenu } from "@/components/layout/user-menu"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-store"
import { AUTH_LINKS, PRODUCT_LINKS } from "@/lib/nav"
import { useSignOut } from "@/lib/user"
import { cn } from "@/lib/utils"

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-lg px-3 py-2.5 text-base font-medium transition-colors hover:bg-accent", isActive ? "text-foreground underline decoration-primary decoration-[3px] underline-offset-8" : "text-muted-foreground hover:text-foreground")

/** Marketing header. Solid enough that nothing behind it ever shows through the logo or links. */
export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, status } = useAuth()
  const signOut = useSignOut()
  const close = () => setOpen(false)
  const links = PRODUCT_LINKS.filter((l) => l.to !== "/#faq")

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-3">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) =>
            l.to.includes("#") ? (
              <Link key={l.to} to={l.to} className={navLink({ isActive: false })}>{l.label}</Link> // a section of the home page is never "the current page"
            ) : (
              <NavLink key={l.to} to={l.to} end className={navLink}>{l.label}</NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 md:flex">
            {status === "loading" && <Skeleton className="h-11 w-32 rounded-xl" aria-hidden="true" />}
            {status === "authenticated" && user && (
              <>
                <Link to="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}><LayoutDashboard aria-hidden="true" />Dashboard</Link>
                <UserMenu user={user} />
              </>
            )}
            {status === "anonymous" && (
              <>
                <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Log in</Link>
                <Link to="/signup" className={buttonVariants({ size: "sm" })}>Sign up</Link>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu" />}><Menu aria-hidden="true" /></SheetTrigger>
            <SheetContent side="right" className="surface-textured w-[85vw] max-w-sm p-6">
              <SheetTitle className="font-display text-2xl">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <nav aria-label="Mobile" className="mt-2 flex flex-col gap-1">
                {user && <NavLink to="/dashboard" onClick={close} className={(s) => cn(navLink(s), "flex items-center gap-2 py-3 text-lg")}><LayoutDashboard className="size-5" aria-hidden="true" />Dashboard</NavLink>}
                {links.map((l) => <Link key={l.to} to={l.to} onClick={close} className={cn(navLink({ isActive: false }), "py-3 text-lg")}>{l.label}</Link>)}
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                {user ? (
                  <Button variant="outline" size="lg" onClick={() => { close(); void signOut() }}><LogOut aria-hidden="true" />Log out</Button>
                ) : (
                  AUTH_LINKS.map((l, i) => <Link key={l.to} to={l.to} onClick={close} className={buttonVariants({ variant: i ? "default" : "outline", size: "lg" })}>{l.label}</Link>)
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
