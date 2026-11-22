import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { useDeleteScan } from "@/lib/report"

/** Confirm-before-delete. Focus goes to "Cancel" first (the safe choice) and returns to the opener on close. */
export function DeleteScanDialog({ scanId, label, open, onOpenChange, onDeleted }: { scanId: string; label: string; open: boolean; onOpenChange: (o: boolean) => void; onDeleted?: () => void }) {
  const del = useDeleteScan()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
          <AlertDialogDescription>
            The report for <strong>{label}</strong> and its screenshot will be removed from your account. This can't be undone. Deleting doesn't give back any of your scan allowance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep scan</AlertDialogCancel>
          <Button
            variant="destructive" disabled={del.isPending}
            onClick={() =>
              del.mutate(scanId, {
                onSuccess: () => {
                  onOpenChange(false)
                  toast.success("Scan deleted")
                  onDeleted?.()
                },
                onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete the scan. Please try again."),
              })
            }
          >
            {del.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}Delete scan
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
