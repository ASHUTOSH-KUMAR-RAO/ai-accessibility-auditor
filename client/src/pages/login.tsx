import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { FormAlert } from "@/components/auth/form-alert"
import { PasswordField } from "@/components/auth/password-field"
import { SubmitButton } from "@/components/auth/submit-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-store"
import { loginSchema, useAuthSubmit, type LoginValues } from "@/lib/auth-forms"
import { useMotionScale } from "@/lib/motion"

export default function Login() {
  const { login } = useAuth()
  const { distance, speed } = useMotionScale()
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } })
  const { errors, isSubmitting } = form.formState
  const { submit, problem } = useAuthSubmit(form, async (v) => {
    await login(v)
    toast.success("Welcome back")
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 * distance }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-md"
    >
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Sign in to AccessLens</h1>
      <p className="mt-3 text-muted-foreground">Pick up your audits where you left off.</p>

      <form onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate className="mt-8">
        <FieldGroup className="gap-6">
          <FormAlert problem={problem} onRetry={() => void submit()} />

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
              id="password" autoComplete="current-password"
              aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            <FieldError id="password-error">{errors.password?.message}</FieldError>
          </Field>

          <SubmitButton busy={isSubmitting} busyLabel="Signing in…">Sign in</SubmitButton>
        </FieldGroup>
      </form>

      <p className="mt-8 text-center text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-link underline underline-offset-4 hover:decoration-[3px]">Create an account</Link>
      </p>
    </motion.div>
  )
}
