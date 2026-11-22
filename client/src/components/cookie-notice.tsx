import { useEffect, useState } from "react"
import { Cookie } from "lucide-react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useMotionScale } from "@/lib/motion"

const KEY = "accesslens:cookie-notice"
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false // storage blocked: show the notice again next visit rather than break
  }
}

/** Small, non-blocking notice: we only use essential cookies and storage. It never traps focus or covers the page. */
export function CookieNotice() {
  const [visible, setVisible] = useState(false)
  const { distance, speed } = useMotionScale()
  useEffect(() => {
    if (read()) return
    const id = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(id)
  }, [])
  if (!visible) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }
  return (
    <motion.section
      aria-label="Cookie notice"
      initial={{ opacity: 0, y: 30 * distance }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 * speed, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-2xl border border-border bg-popover p-4 shadow-lift sm:inset-x-auto sm:bottom-5 sm:left-5 sm:mx-0"
    >
      <p className="flex gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span className="text-sm">AccessLens uses only essential cookies and browser storage (to keep you signed in and remember your theme). No tracking. <Link to="/cookies" className="font-medium text-link underline underline-offset-4">Details</Link></span>
      </p>
      <Button size="sm" className="mt-3 w-full sm:w-auto" onClick={dismiss}>Got it</Button>
    </motion.section>
  )
}
