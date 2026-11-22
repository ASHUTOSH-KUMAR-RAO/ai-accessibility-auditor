import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { useMotionScale } from "@/lib/motion"

export function AppLayout() {
  const { pathname } = useLocation()
  const { distance, speed } = useMotionScale()

  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.getElementById("main")?.focus({ preventScroll: true }) // announce navigation to keyboard / SR users
  }, [pathname])

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 18 * distance }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 * distance }}
            transition={{ duration: 0.35 * speed, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <SiteFooter />
    </>
  )
}
