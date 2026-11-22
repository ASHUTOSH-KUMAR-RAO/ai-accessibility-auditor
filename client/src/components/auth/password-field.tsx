import { useState, type ComponentProps } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Password input with an accessible show/hide toggle (a real button, announced as pressed). */
export function PasswordField({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-14", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 hover:translate-y-[-50%] active:translate-y-[-50%]"
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
}
