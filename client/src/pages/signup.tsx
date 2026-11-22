import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { FormAlert } from "@/components/auth/form-alert"
import { PasswordField } from "@/components/auth/password-field"
import { PasswordStrength } from "@/components/auth/password-strength"
import { SubmitButton } from "@/components/auth/submit-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-store"
import { registerSchema, useAuthSubmit, type RegisterValues } from "@/lib/auth-forms"
import { useMotionScale } from "@/lib/motion"

export default function Signup() {
  const { register: signUp } = useAuth()
  const { distance, speed } = useMotionScale()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState
  const password = useWatch({ control: form.control, name: "password" })
  const { submit, problem } = useAuthSubmit(form, async ({ name, email, password }) => {
    await signUp({ name, email, password })
    toast.success("Account created. Welcome to AccessLens!")
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 * distance }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-md"
    >
      <p className="eyebrow">Get started — it's free</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Create your account</h1>
      <p className="mt-3 text-muted-foreground">Scan any site and get fixes in plain language.</p>

      <form onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate className="mt-8">
        <FieldGroup className="gap-6">
          <FormAlert problem={problem} onRetry={() => void submit()} />

          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name" className="text-base font-semibold">Name</FieldLabel>
            <Input
              id="name" type="text" autoComplete="name"
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined}
              {...form.register("name")}
            />
            <FieldError id="name-error">{errors.name?.message}</FieldError>
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email" className="text-base font-semibold">Email</FieldLabel>
            <Input
              id="email" type="email" autoComplete="email" inputMode="email"
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            <FieldError id="email-error">{errors.email?.message}</FieldError>
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password" className="text-base font-semibold">Password</FieldLabel>
            <PasswordField
              id="password" autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error password-strength" : "password-strength"}
              {...form.register("password")}
            />
            <FieldError id="password-error">{errors.password?.message}</FieldError>
            <PasswordStrength id="password-strength" password={password} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword" className="text-base font-semibold">Confirm password</FieldLabel>
            <PasswordField
              id="confirmPassword" autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
              {...form.register("confirmPassword")}
            />
            <FieldError id="confirm-error">{errors.confirmPassword?.message}</FieldError>
          </Field>

          <SubmitButton busy={isSubmitting} busyLabel="Creating account…">Create account</SubmitButton>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        By creating an account you agree to our{" "}
        <Link to="/terms" className="font-medium text-link underline underline-offset-4">Terms</Link> and{" "}
        <Link to="/privacy" className="font-medium text-link underline underline-offset-4">Privacy Policy</Link>.
      </p>
      <p className="mt-6 text-center text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-link underline underline-offset-4 hover:decoration-[3px]">Sign in</Link>
      </p>
    </motion.div>
  )
}
