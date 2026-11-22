import { useId, useState, type FormEvent } from "react"
import { ArrowRight, FileSearch, Globe, Loader2 } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BrailleText } from "@/components/brand/braille-text"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-store"
import { ApiError } from "@/lib/api"
import { useMotionScale } from "@/lib/motion"
import { setPendingUrl } from "@/lib/pending-scan"
import { errorCopy, useCreateScan } from "@/lib/scans"
import { checkUrlInput } from "@/lib/url"
import { ScanMockup } from "./scan-mockup"

/** Signed-out: remember the URL and go to sign-up (it is scanned right after). Signed-in: scan straight away. */
function HeroForm() {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { status } = useAuth()
  const navigate = useNavigate()
  const create = useCreateScan()
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const check = checkUrlInput(value)
    if (!check.ok) return setError(check.message)
    setError(null)
    if (status !== "authenticated") {
      setPendingUrl(check.url)
      return navigate("/signup")
    }
    create.mutate({ url: check.url, viewport: "DESKTOP" }, {
      onSuccess: (scan) => navigate(`/scans/${scan.id}`),
      onError: (err) => setError(err instanceof ApiError ? (err.code === "TOO_MANY_ACTIVE" || err.code === "RATE_LIMITED" ? err.message : `${errorCopy(err.code).title}. ${errorCopy(err.code).hint}`) : "Something went wrong. Please try again."),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className="mb-2 block text-base font-semibold">Website to audit</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={id} type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="https://your-site.com"
            value={value} onChange={(e) => setValue(e.target.value)} disabled={create.isPending}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-hint`} className="h-14 pl-12 text-lg"
          />
        </div>
        <Button type="submit" size="lg" disabled={create.isPending} className="h-14 px-7 text-lg sm:min-w-48">
          {create.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Starting…</> : <>Scan website <ArrowRight aria-hidden="true" /></>}
        </Button>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">{status === "authenticated" ? "Starts your scan right away." : "Free account needed: we remember this address and scan it as soon as you are in."}</p>
      <p id={`${id}-error`} role="alert" className="mt-1 min-h-6 text-base font-medium text-destructive">{error}</p>
    </form>
  )
}

export function Hero() {
  const { distance, speed } = useMotionScale()
  const rise = (i: number, fade = true) => ({
    initial: { opacity: fade ? 0 : 1, y: 30 * distance },
    animate: { opacity: 1, y: 0 },
    transition: { delay: (0.05 + i * 0.1) * speed, duration: 0.7 * speed, ease: [0.22, 1, 0.36, 1] as const },
  })
  return (
    <section aria-labelledby="hero-title" className="container-page grid items-center gap-16 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-20">
      <div className="min-w-0">
        <motion.div {...rise(0)} className="flex items-center gap-4"><BrailleText text="a11y" /><span className="eyebrow">WCAG 2.2 accessibility auditor</span></motion.div>
        {/* the h1 is the largest paint: it only slides in (no opacity fade) so it is never invisible while loading */}
        <motion.h1 id="hero-title" {...rise(1, false)} className="mt-6 text-[2.7rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
          Make the web usable for{" "}
          <span className="relative inline-block italic">
            everyone.
            <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-1 left-0 h-2.5 w-full text-primary">
              <motion.path d="M2 8 C 40 2, 80 12, 120 6 S 180 4, 198 7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8 * speed, duration: 0.9 * speed, ease: "easeOut" }} />
            </svg>
          </span>
        </motion.h1>
        <motion.p {...rise(2, false)} className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
          Paste any URL. AccessLens audits it against WCAG, shows exactly where the problems are, and an AI explains each one in plain words, with fixed code that is checked before you see it.
        </motion.p>
        <motion.div {...rise(3)} className="mt-9 max-w-xl"><HeroForm /></motion.div>
        <motion.div {...rise(4)} className="mt-2"><Link to="/sample" className={buttonVariants({ variant: "outline", size: "lg" })}><FileSearch aria-hidden="true" />See a sample report</Link></motion.div>
      </div>
      <motion.div {...rise(2)} className="min-w-0 pb-6"><ScanMockup /></motion.div>
    </section>
  )
}
