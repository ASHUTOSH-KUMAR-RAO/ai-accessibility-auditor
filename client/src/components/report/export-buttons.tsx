import { useState } from "react"
import { FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { downloadFile } from "@/lib/insights"

type Kind = "csv" | "json" | "pdf"
const COPY: Record<Kind, { label: string; busy: string; icon: typeof FileText }> = {
  csv: { label: "CSV", busy: "Preparing CSV…", icon: FileSpreadsheet },
  json: { label: "JSON", busy: "Preparing JSON…", icon: FileJson },
  pdf: { label: "PDF report", busy: "Creating PDF…", icon: FileText },
}

/** Downloads need the bearer token, so each button fetches the file and saves it. Progress is announced politely. */
export function ExportButtons({ scanId, kinds, ruleIds, size = "sm" }: { scanId: string; kinds: Kind[]; ruleIds?: string[]; size?: "sm" | "default" }) {
  const [busy, setBusy] = useState<Kind | null>(null)
  const run = async (kind: Kind) => {
    setBusy(kind)
    try {
      const q = kind !== "pdf" && ruleIds ? `?rules=${encodeURIComponent(ruleIds.join(","))}` : ""
      await downloadFile(kind === "pdf" ? `/scans/${scanId}/report.pdf` : `/scans/${scanId}/export.${kind}${q}`, `accesslens.${kind}`)
      toast.success(kind === "pdf" ? "PDF report downloaded" : `${COPY[kind].label} downloaded`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The download failed. Please try again.")
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => {
        const { icon: Icon, label } = COPY[k]
        return (
          <Button key={k} variant="outline" size={size} disabled={busy !== null} aria-busy={busy === k} onClick={() => void run(k)}>
            {busy === k ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
            {busy === k ? COPY[k].busy : k === "pdf" ? label : `Export ${label}`}
          </Button>
        )
      })}
      <span role="status" className="sr-only">{busy ? COPY[busy].busy : ""}</span>
    </div>
  )
}
