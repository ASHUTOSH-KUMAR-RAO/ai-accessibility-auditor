import { cn } from "@/lib/utils"
import { STRENGTH_LABELS, passwordStrength } from "@/lib/auth-forms"

/** Bars are decorative; the text label is what screen readers get (polite live region). */
export function PasswordStrength({ id, password }: { id: string; password: string }) {
  const level = passwordStrength(password)
  return (
    <div id={id} className="mt-1">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", password && n <= level ? "bg-amber-600 dark:bg-amber-500" : "bg-border")} />
        ))}
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
        {password ? <>Password strength: <strong className="font-semibold text-foreground">{STRENGTH_LABELS[level]}</strong></> : "Use 8+ characters with a letter and a number."}
      </p>
    </div>
  )
}
