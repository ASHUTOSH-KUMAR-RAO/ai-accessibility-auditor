import { lazy, Suspense, useState } from "react"
import { Check, Clock, Eye, EyeOff, Link2, Loader2, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { apiUrl, EXPIRY_LABEL, siteUrl, useCreateShare, useRevokeShare, useShares, type CreatedShare, type Expiry } from "@/lib/insights"
import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"

// The QR encoder is only fetched when a link has just been created
const QrCode = lazy(() => import("./qr-code"))

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
const FIELD = "h-11 w-full rounded-xl border-2 border-input bg-card px-3 text-base"

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={cn(FIELD, "min-w-0 font-mono text-sm")} />
        <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} className="size-11 shrink-0" />
      </div>
    </div>
  )
}

function Created({ created }: { created: CreatedShare }) {
  const link = siteUrl(created.path)
  const badge = apiUrl(created.badgePath)
  const md = `[![Accessibility score](${badge})](${link})`
  return (
    <section aria-labelledby="share-created" className="space-y-4 rounded-2xl border-2 border-foreground p-4">
      <h3 id="share-created" className="flex items-center gap-2 text-base font-semibold"><Check className="size-5" aria-hidden="true" />Link created</h3>
      <p className="flex gap-2 rounded-xl bg-muted p-3 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Copy it now. For security we only store a fingerprint of the link, so it can't be shown again. Revoke it and create a new one if you lose it.</p>
      <CopyField id="share-link" label="Share link" value={link} />
      <div className="flex flex-wrap items-start gap-4">
        <Suspense fallback={<Skeleton className="size-36 rounded-xl" aria-hidden="true" />}><QrCode value={link} /></Suspense>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm font-semibold">Score badge for a README</p>
          <img src={badge} alt="Preview of the accessibility score badge" className="h-[22px]" />
          <CopyField id="share-badge-md" label="Markdown for the badge" value={md} />
        </div>
      </div>
    </section>
  )
}

/** Create, copy and revoke read-only links. Visitors see the report without signing in; they can't change or generate anything. */
export function ShareDialog({ scanId, open, onOpenChange }: { scanId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [expiry, setExpiry] = useState<Expiry>("7d")
  const [hide, setHide] = useState(false)
  const [created, setCreated] = useState<CreatedShare | null>(null)
  const shares = useShares(scanId, open)
  const create = useCreateShare(scanId)
  const revoke = useRevokeShare(scanId)

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setCreated(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this report</DialogTitle>
          <DialogDescription>Anyone with the link can read this report without an account. They can't change anything, re-scan, or use AI.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate({ expiry, hideScreenshot: hide }, { onSuccess: setCreated, onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't create the link.") })
            }}
          >
            <div>
              <label htmlFor="share-expiry" className="mb-1.5 block text-sm font-semibold">Link expires after</label>
              <select id="share-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} className={cn(FIELD, "cursor-pointer")}>
                {(Object.keys(EXPIRY_LABEL) as Expiry[]).map((k) => <option key={k} value={k}>{EXPIRY_LABEL[k]}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--foreground)]" />
              <span><span className="block font-semibold">Hide the screenshot</span><span className="text-sm text-muted-foreground">Useful if the page shows personal or private content. Visitors still see the issues and code.</span></span>
            </label>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}Create link
            </Button>
          </form>

          {created && <Created created={created} />}

          <section aria-labelledby="active-links">
            <h3 id="active-links" className="mb-3 text-base font-semibold">Active links</h3>
            {shares.isPending ? (
              <Skeleton className="h-16 w-full rounded-xl" aria-hidden="true" />
            ) : shares.isError ? (
              <p role="alert" className="text-sm text-critical">Couldn't load your links.</p>
            ) : shares.data.length === 0 ? (
              <p className="text-muted-foreground">No active links yet.</p>
            ) : (
              <ul className="space-y-2">
                {shares.data.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border p-3">
                    <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                      <p className="font-semibold">Created <time dateTime={s.createdAt}>{dateFmt.format(new Date(s.createdAt))}</time></p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="size-4" aria-hidden="true" />{s.expiresAt ? <>Expires <time dateTime={s.expiresAt}>{dateFmt.format(new Date(s.expiresAt))}</time></> : "Never expires"}</span>
                        <span className="inline-flex items-center gap-1">{s.hideScreenshot ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}{s.hideScreenshot ? "Screenshot hidden" : "Screenshot shown"}</span>
                        <span>{s.views} {s.views === 1 ? "view" : "views"}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline" size="sm" disabled={revoke.isPending && revoke.variables === s.id}
                      onClick={() => revoke.mutate(s.id, { onSuccess: () => toast.success("Link revoked. It no longer works."), onError: () => toast.error("Couldn't revoke the link.") })}
                    >
                      <Trash2 aria-hidden="true" />Revoke<span className="sr-only"> link created {dateFmt.format(new Date(s.createdAt))}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
