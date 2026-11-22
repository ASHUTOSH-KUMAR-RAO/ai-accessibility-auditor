import { useId, useState, type FormEvent } from "react"
import { ArrowRight, Globe, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { FormAlert } from "@/components/auth/form-alert"
import { ViewportToggle } from "@/components/scans/viewport-toggle"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import { errorCopy, useCreateScan, type Viewport } from "@/lib/scans"
import { checkUrlInput } from "@/lib/url"
import type { FormProblem } from "@/lib/auth-forms"

/** URL → scan. Field-level problems (bad address, blocked host) show inline; limits/network show in the alert. */
export function ScanForm({ initialUrl = "" }: { initialUrl?: string }) {
  const [value, setValue] = useState(initialUrl)
  const [viewport, setViewport] = useState<Viewport>("DESKTOP")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [problem, setProblem] = useState<FormProblem | null>(null)
  const navigate = useNavigate()
  const create = useCreateScan()
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setProblem(null)
    const check = checkUrlInput(value)
    if (!check.ok) {
      setFieldError(check.message)
      return
    }
    setFieldError(null)

    create.mutate(
      { url: check.url, viewport },
      {
        onSuccess: (scan) => navigate(`/scans/${scan.id}`),
        onError: (err) => {
          const e = err instanceof ApiError ? err : new ApiError("Something went wrong. Please try again.", null, "UNKNOWN")
          if (e.code === "INVALID_URL" || e.code === "BLOCKED_HOST") {
            setFieldError(`${errorCopy(e.code).title}. ${errorCopy(e.code).hint}`)
          } else if (e.isNetwork) {
            setProblem({ message: e.message, retryable: true })
            toast.error(e.message, { action: { label: "Retry", onClick: () => submit() } })
          } else {
            setProblem({ message: e.code === "TOO_MANY_ACTIVE" || e.code === "RATE_LIMITED" ? e.message : errorCopy(e.code).title, retryable: false })
          }
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className="mb-2 block text-base font-semibold">Website to audit</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={create.isPending}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? `${errorId} ${hintId}` : hintId}
            className="h-14 pl-12 text-lg"
          />
        </div>
        <Button type="submit" size="lg" disabled={create.isPending} className="sm:min-w-44">
          {create.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Starting…</> : <>Scan website <ArrowRight aria-hidden="true" /></>}
        </Button>
      </div>
      <p id={hintId} className="mt-2 text-sm text-muted-foreground">We'll add https:// for you. Only public websites can be scanned.</p>
      <FieldError id={errorId} className="mt-2 min-h-6 text-base font-medium">{fieldError}</FieldError>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-sm font-semibold" id={`${id}-vp`}>Scan as</span>
        <ViewportToggle value={viewport} onChange={setViewport} disabled={create.isPending} />
      </div>

      <div className="mt-4"><FormAlert problem={problem} onRetry={() => submit()} /></div>
    </form>
  )
}
