import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { ScanSearch } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { BrailleText } from "@/components/brand/braille-text"
import { EmptyDashboard, SitesPanel, TopIssues } from "@/components/dashboard/dashboard-panels"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentScans } from "@/components/scans/recent-scans"
import { ScanForm } from "@/components/scans/scan-form"
import { useAuth } from "@/context/auth-store"
import { ApiError } from "@/lib/api"
import { useDashboard } from "@/lib/insights"
import { useMotionScale } from "@/lib/motion"
import { takePendingUrl } from "@/lib/pending-scan"
import { useCreateScan } from "@/lib/scans"
import { useSeo } from "@/lib/seo"

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

export default function Dashboard() {
  useSeo({ title: "Dashboard", description: "Your scans, sites and accessibility scores.", path: "/dashboard", noindex: true })
  const { user } = useAuth()
  const { distance, speed } = useMotionScale()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const create = useCreateScan()
  const dash = useDashboard()
  const first = user?.name.split(" ")[0]
  const started = useRef(false)

  // The visitor typed an address on the landing page before signing up: scan it now.
  useEffect(() => {
    if (started.current) return
    started.current = true
    const url = takePendingUrl()
    if (!url) return
    create.mutate({ url, viewport: "DESKTOP" }, {
      onSuccess: (scan) => navigate(`/scans/${scan.id}`, { replace: true }),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't start your scan. Enter the address again below."),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, [])

  const empty = dash.data && dash.data.totals.scans === 0

  return (
    <section aria-labelledby="dash-title" className="container-page space-y-8 py-10 sm:py-14">
      <motion.div initial={{ opacity: 0, y: 24 * distance }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] }}>
        <BrailleText text="hello" />
        <h1 id="dash-title" className="mt-5 text-4xl font-semibold sm:text-6xl">{greeting()}, {first}.</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">Scan a website and watch the audit happen, step by step.</p>
      </motion.div>

      <section aria-labelledby="scan-h" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-7">
        <h2 id="scan-h" className="mb-4 flex items-center gap-2.5 font-display text-2xl font-semibold"><ScanSearch className="size-6" aria-hidden="true" />Scan a website</h2>
        <ScanForm initialUrl={params.get("url") ?? ""} />
      </section>

      <StatsCards data={dash.data} isPending={dash.isPending} isError={dash.isError} refetch={() => void dash.refetch()} />

      {empty ? (
        <EmptyDashboard />
      ) : (
        dash.data && (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            <SitesPanel sites={dash.data.sites} />
            <TopIssues issues={dash.data.topIssues} />
          </div>
        )
      )}

      {!empty && <RecentScans />}
    </section>
  )
}
