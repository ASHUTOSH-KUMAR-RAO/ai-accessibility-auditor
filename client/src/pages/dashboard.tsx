import { motion } from "framer-motion"
import { Mail, ScanSearch } from "lucide-react"
import { BrailleText } from "@/components/brand/braille-text"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UrlForm } from "@/components/url-form"
import { useAuth } from "@/context/auth-store"
import { useMotionScale } from "@/lib/motion"

export default function Dashboard() {
  const { user } = useAuth()
  const { distance, speed } = useMotionScale()
  const first = user?.name.split(" ")[0]

  return (
    <section aria-labelledby="dash-title" className="container-page py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 * distance }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] }}
      >
        <BrailleText text="hello" />
        <h1 id="dash-title" className="mt-5 text-4xl font-semibold sm:text-6xl">Welcome back, {first}.</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">Your scans will appear here. Start with a website you care about.</p>
      </motion.div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="rounded-3xl border border-border bg-card/90 p-2 shadow-soft ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 font-display text-2xl"><ScanSearch className="size-6" aria-hidden="true" />Scan a website</CardTitle>
          </CardHeader>
          <CardContent><UrlForm /></CardContent>
        </Card>

        <Card className="rounded-3xl border border-border bg-card/90 p-2 shadow-soft ring-0">
          <CardHeader><CardTitle className="font-display text-2xl">Your account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold">{user?.name}</p>
            <p className="flex items-center gap-2 break-all text-muted-foreground"><Mail className="size-4 shrink-0" aria-hidden="true" />{user?.email}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
