import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

/** Scrollable modal: focus is trapped, Escape closes, focus returns to the opener. */
function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className="fixed inset-0 isolate z-50 bg-black/30 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[min(92dvh,48rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-lift outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-3" />}>
          <X aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex flex-col gap-1.5 border-b border-border p-5 pr-14 sm:p-6 sm:pr-16", className)} {...props} />
const DialogBody = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-6", className)} {...props} />

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-display text-2xl font-semibold leading-tight", className)} {...props} />
}
function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-muted-foreground", className)} {...props} />
}

export { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle }
