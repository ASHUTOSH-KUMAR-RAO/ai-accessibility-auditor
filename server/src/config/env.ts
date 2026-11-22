import "dotenv/config"
import { z } from "zod"

/** "https://a.com/, http://localhost:5173" -> ["https://a.com", "http://localhost:5173"] */
export function parseOrigins(raw: string): string[] {
  return raw.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  CLIENT_URL: z.string().min(1).transform(parseOrigins).refine((o) => o.length > 0, "CLIENT_URL needs at least one origin"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  // Fail fast; print variable names + reasons only, never values.
  const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
  console.error(`Invalid environment configuration:\n${lines.join("\n")}`)
  process.exit(1)
}

export const env = result.data
export const isProd = env.NODE_ENV === "production"
