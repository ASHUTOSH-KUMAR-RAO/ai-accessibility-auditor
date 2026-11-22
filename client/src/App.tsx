import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { PageLoader, ProtectedRoute, PublicRoute } from "@/components/auth/route-guards"
import { AppLayout } from "@/components/layout/app-layout"
import { PLACEHOLDER_ROUTES } from "@/lib/nav"

// Route-level code splitting: each page (and its heavy deps) loads on demand.
const Home = lazy(() => import("@/pages/home"))
const Login = lazy(() => import("@/pages/login"))
const Signup = lazy(() => import("@/pages/signup"))
const Dashboard = lazy(() => import("@/pages/dashboard"))
const AuthLayout = lazy(() => import("@/components/auth/auth-layout").then((m) => ({ default: m.AuthLayout })))
const NotFound = lazy(() => import("@/pages/simple-pages").then((m) => ({ default: m.NotFound })))
const ComingSoon = lazy(() => import("@/pages/simple-pages").then((m) => ({ default: m.ComingSoon })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth pages: no site header/footer */}
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
          </Route>

          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            {PLACEHOLDER_ROUTES.map((r) => (
              <Route key={r.to} path={r.to} element={<ComingSoon />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
