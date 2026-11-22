import { useCallback, useState } from "react"
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ApiError } from "@/lib/api"

const email = z.string().trim().min(1, "Enter your email address").pipe(z.email("Enter a valid email address, like name@example.com"))

export const passwordRules = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number")

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name (at least 2 characters)").max(60, "Use 60 characters or fewer"),
    email,
    password: passwordRules,
    confirmPassword: z.string().min(1, "Re-enter your password"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>

// ───────────── Password strength (a hint, not a gate: the rules above are the gate) ─────────────
export const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const

export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 8) return 0
  let score = 1
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4) as 1 | 2 | 3 | 4
}

// ───────────── Server error → form state ─────────────
export interface FormProblem { message: string; retryable: boolean }

/** Submits via `action`, mapping API failures onto fields / a form-level alert / a retry toast. */
export function useAuthSubmit<T extends FieldValues>(form: UseFormReturn<T>, action: (values: T) => Promise<void>) {
  const [problem, setProblem] = useState<FormProblem | null>(null)

  const submit = useCallback(
    () =>
      form.handleSubmit(async (values) => {
        setProblem(null)
        try {
          await action(values)
        } catch (err) {
          const e = err instanceof ApiError ? err : new ApiError("Something went wrong. Please try again.", null, "UNKNOWN")

          const issues = Array.isArray(e.details) ? (e.details as Array<{ path?: unknown[]; message?: string }>) : []
          const fieldIssues = issues.filter((i) => typeof i.path?.[0] === "string" && i.message)
          if (fieldIssues.length) {
            fieldIssues.forEach((i, idx) =>
              form.setError(i.path![0] as FieldPath<T>, { type: "server", message: i.message }, { shouldFocus: idx === 0 }),
            )
            return
          }

          setProblem({ message: e.message, retryable: e.isNetwork })
          if (e.isNetwork) toast.error(e.message, { action: { label: "Retry", onClick: () => void submit() } })
        }
      })(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `submit` refers to itself for the retry toast
    [form, action],
  )

  return { submit, problem, clearProblem: () => setProblem(null) }
}
