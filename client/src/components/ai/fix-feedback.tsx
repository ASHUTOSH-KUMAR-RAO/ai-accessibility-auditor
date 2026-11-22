import { useState } from "react"
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useFixFeedback } from "@/lib/ai"
import { cn } from "@/lib/utils"

/** Thumbs up / down. A "not helpful" vote can add a short reason. Votes are stored for improving the prompts. */
export function FixFeedback({ fixId }: { fixId: string }) {
  const [vote, setVote] = useState<boolean | null>(null)
  const [reason, setReason] = useState("")
  const [sent, setSent] = useState(false)
  const mutation = useFixFeedback(fixId)

  const send = (helpful: boolean, why?: string) =>
    mutation.mutate(
      { helpful, reason: why },
      {
        onSuccess: () => {
          setSent(true)
          toast.success("Thanks, that helps us improve the fixes.")
        },
        onError: () => toast.error("Couldn't save your feedback. Please try again."),
      },
    )

  const choose = (helpful: boolean) => {
    setVote(helpful)
    setSent(false)
    if (helpful) send(true)
  }

  const btn = (helpful: boolean) =>
    cn("min-h-11", vote === helpful && "border-2 border-foreground bg-accent")

  return (
    <section aria-labelledby={`fb-${fixId}`} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`fb-${fixId}`} className="mr-1 text-sm font-semibold">Was this fix helpful?</h3>
        <Button type="button" variant="outline" size="sm" aria-pressed={vote === true} className={btn(true)} onClick={() => choose(true)}>
          <ThumbsUp aria-hidden="true" />Helpful
        </Button>
        <Button type="button" variant="outline" size="sm" aria-pressed={vote === false} className={btn(false)} onClick={() => choose(false)}>
          <ThumbsDown aria-hidden="true" />Not helpful
        </Button>
        <span role="status" className="text-sm text-muted-foreground">{sent ? "Feedback saved" : ""}</span>
      </div>
      {vote === false && !sent && (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); send(false, reason) }}>
          <label htmlFor={`why-${fixId}`} className="sr-only">What was wrong with this fix? (optional)</label>
          <input
            id={`why-${fixId}`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="What was wrong? (optional)"
            className="h-11 min-w-0 flex-1 rounded-xl border-2 border-input bg-card px-3 text-base"
          />
          <Button type="submit" variant="outline" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}Send
          </Button>
        </form>
      )}
    </section>
  )
}
