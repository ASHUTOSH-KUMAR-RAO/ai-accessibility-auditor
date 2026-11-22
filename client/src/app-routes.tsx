import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { PageLoader, ProtectedRoute, PublicRoute } from "@/components/auth/route-guards"
import { CookieNotice } from "@/components/cookie-notice"
import { AppLayout } from "@/components/layout/app-layout"
import { AppShell } from "@/components/layout/app-shell"

// Route-level code splitting: each page (and its heavy deps) loads on demand.
// The public pages are imported directly (not lazily) so the build-time prerender can render them and visitors get no extra request chain.
import Features from "@/pages/features"
import Home from "@/pages/home"
import { Cookies, Privacy, Terms } from "@/pages/legal"
import SampleReport from "@/pages/sample"
import { NotFound } from "@/pages/simple-pages"
const Login = lazy(() => import("@/pages/login"))
const Signup = lazy(() => import("@/pages/signup"))
const Dashboard = lazy(() => import("@/pages/dashboard"))
const ScanPage = lazy(() => import("@/pages/scan"))
const Sites = lazy(() => import("@/pages/sites"))
const SitePage = lazy(() => import("@/pages/site"))
const ComparePage = lazy(() => import("@/pages/compare"))
const PublicReport = lazy(() => import("@/pages/public-report"))
const History = lazy(() => import("@/pages/history"))
const AuthLayout = lazy(() => import("@/components/auth/auth-layout").then((m) => ({ default: m.AuthLayout })))

export function AppRoutes() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth pages: no site header/footer */}
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
          </Route>

          {/* Shared reports: no account, no app chrome */}
          <Route path="/r/:token" element={<PublicReport />} />

          {/* Public pages */}
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/sample" element={<SampleReport />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Signed-in app: sidebar shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scans" element={<History />} />
              <Route path="/scans/:id" element={<ScanPage />} />
              <Route path="/sites" element={<Sites />} />
              <Route path="/sites/:host" element={<SitePage />} />
              <Route path="/compare" element={<ComparePage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <CookieNotice />
    </>
  )
}
