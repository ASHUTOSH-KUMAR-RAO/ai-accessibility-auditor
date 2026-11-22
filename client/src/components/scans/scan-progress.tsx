import { Loader2, Timer, X } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { StageStepper } from "@/components/scans/stage-stepper"
import { Button } from "@/components/ui/button"
import { useMotionScale } from "@/lib/motion"
import { STAGES, useCancelScan, type Scan } from "@/lib/scans"
import { formatDuration, useNow } from "@/lib/time"

export function ScanProgress({ scan }: { scan: Scan }) {
  const { speed } = useMotionScale()
  const cancel = useCancelScan()
  const now = useNow(true)

  const queued = scan.status === "QUEUED"
  const stageIndex = queued ? -1 : Math.max(0, STAGES.indexOf((scan.stage ?? "") as (typeof STAGES)[number]))
  const since = new Date(scan.startedAt ?? scan.createdAt).getTime()
  const elapsed = formatDuration(now - since)
  // Announced only when the stage changes (not on every progress tick).
  const announcement = queued ? "Waiting in the queue" : `Step ${stageIndex + 1} of ${STAGES.length}: ${STAGES[stageIndex]}`

  return (
    <section aria-labelledby="progress-title" className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="progress-title" className="font-display text-3xl font-semibold">{queued ? "Waiting for a free slot…" : `${STAGES[stageIndex]}…`}</h2>
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            <Timer className="size-4" aria-hidden="true" />
            <span>Elapsed <span className="font-semibold tabular-nums text-foreground">{elapsed}</span></span>
          </p>
        </div>
        <Button
          variant="outline"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(scan.id, { onError: () => toast.error("Couldn't cancel the scan. It may have just finished.") })}
        >
          {cancel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
          Cancel scan
        </Button>
      </div>

      <p role="status" className="sr-only">{announcement}</p>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-sm font-medium">
          <span>Progress</span>
          <span className="tabular-nums">{scan.progress}%</span>
        </div>
        <div
          role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scan.progress}
          className="relative h-3 overflow-hidden rounded-full bg-border"
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-600 dark:bg-amber-500"
            initial={false}
            animate={{ width: `${Math.max(scan.progress, 3)}%` }}
            transition={{ duration: 0.8 * speed, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ["-120%", "420%"] }}
            transition={{ duration: 1.8 * speed, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>

      <div className="mt-8"><StageStepper current={stageIndex} /></div>
    </section>
  )
}
