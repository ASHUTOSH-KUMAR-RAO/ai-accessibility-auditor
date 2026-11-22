import { CircleSlash, OctagonAlert, RotateCw } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { errorCopy, useCreateScan, type Scan } from "@/lib/scans"
import { hostOf } from "@/lib/url"

/** FAILED and CANCELLED end states. Retry starts a fresh scan with the same URL and screen size. */
export function ScanProblem({ scan }: { scan: Scan }) {
  const navigate = useNavigate()
  const retry = useCreateScan()
  const failed = scan.status === "FAILED"
  const copy = errorCopy(scan.errorCode)
  const Icon = failed ? OctagonAlert : CircleSlash

  return (
    <section aria-labelledby="problem-title" role="alert" className="rounded-3xl border border-border bg-card/90 p-6 shadow-soft sm:p-10">
      <Icon className={failed ? "size-10 text-critical" : "size-10 text-muted-foreground"} aria-hidden="true" />
      <h2 id="problem-title" className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{failed ? copy.title : "Scan cancelled"}</h2>
      <p className="mt-2 text-lg">{failed ? (scan.errorMessage ?? copy.hint) : `The scan of ${hostOf(scan.url)} was stopped before it finished.`}</p>
      {failed && <p className="mt-2 text-muted-foreground">{copy.hint}</p>}
      <p className="mt-4 break-all text-sm text-muted-foreground">{scan.url}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          disabled={retry.isPending}
          onClick={() => retry.mutate({ url: scan.url, viewport: scan.viewport }, { onSuccess: (s) => navigate(`/scans/${s.id}`), onError: (e) => toast.error(e.message) })}
        >
          <RotateCw aria-hidden="true" />{failed ? "Retry scan" : "Scan again"}
        </Button>
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>Back to dashboard</Link>
      </div>
    </section>
  )
}
