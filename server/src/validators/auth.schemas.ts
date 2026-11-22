import { z } from "zod"

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254))

// bcrypt only hashes the first 72 bytes, so cap the length instead of silently truncating.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number")

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60, "Use 60 characters or fewer"),
  email,
  password: newPassword,
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
