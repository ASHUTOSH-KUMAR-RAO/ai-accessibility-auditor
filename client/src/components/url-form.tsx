import { useId, useState, type FormEvent } from "react"
import { ArrowRight, Globe } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Accepts "example.com" or a full URL; returns a normalised http(s) URL or null. */
function normalise(raw: string): URL | null {
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.includes(".") ? url : null
  } catch {
    return null
  }
}

/** Phase 1 mock: validates and acknowledges. The real scan is wired in the scanner phase. */
export function UrlForm() {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const url = normalise(value)
    if (!url) {
      setError("Enter a full website address, like example.com")
      return
    }
    setError(null)
    toast.info(`Scanner coming soon`, { description: `${url.hostname} is ready to scan once the scanner phase ships.` })
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
