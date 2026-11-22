import { CircleAlert, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FormProblem } from "@/lib/auth-forms"

/** The live region is always mounted so assistive tech announces content the moment it appears. */
export function FormAlert({ problem, onRetry }: { problem: FormProblem | null; onRetry: () => void }) {
  return (
    <div role="alert" aria-atomic="true">
      {problem && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-critical/50 bg-critical-soft p-4 text-critical">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">{problem.message}</p>
            {problem.retryable && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-3 border-critical/50 text-critical">
                <RotateCw aria-hidden="true" />Retry
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
