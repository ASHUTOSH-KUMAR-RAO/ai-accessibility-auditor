import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  // aria-disabled (not `disabled`) would keep it focusable; `disabled` is right here: the form is mid-submit.
  return (
    <Button type="submit" size="lg" disabled={busy} className="w-full">
      {busy ? <><Loader2 className="animate-spin" aria-hidden="true" /><span>{busyLabel}</span></> : children}
    </Button>
  )
}
