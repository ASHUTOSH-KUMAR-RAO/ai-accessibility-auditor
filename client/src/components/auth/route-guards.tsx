import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth-store"
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="container-page grid min-h-[50dvh] place-content-center gap-4 py-20">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-4 w-48 rounded-md" />
    </div>
  )
}

/** Signed-in users only; remembers where they were headed. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === "loading") return <PageLoader label="Checking your session…" />
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login / sign-up pages: signed-in users are sent on to where they were going (or the dashboard). */
export function PublicRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === "loading") return <PageLoader label="Checking your session…" />
  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? "/dashboard"} replace />
  }
  return <Outlet />
}
