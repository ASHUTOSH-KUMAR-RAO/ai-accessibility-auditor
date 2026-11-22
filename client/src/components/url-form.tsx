import { useId, useState, type FormEvent } from "react"
import { ArrowRight, Globe } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { checkUrlInput } from "@/lib/url"

/**
 * Landing-page entry: validates the address, then hands it to the dashboard scan form
 * (/dashboard?url=…). Signed-out visitors are sent through login first and land there afterwards.
 */
export function UrlForm() {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const inputId = useId()
  const errorId = `${inputId}-error`

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const check = checkUrlInput(value)
    if (!check.ok) {
      setError(check.message)
      return
    }
    setError(null)
    navigate(`/dashboard?url=${encodeURIComponent(check.url)}`)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor={inputId} className="mb-2 block text-base font-semibold">Website to audit</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://your-site.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="h-14 pl-12 text-lg"
          />
        </div>
        <Button type="submit" size="lg" className="sm:min-w-44">
          Scan website <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <p id={errorId} role="alert" className="mt-2 min-h-6 text-base font-medium text-destructive">{error}</p>
    </form>
  )
}
