import "dotenv/config"
import { z } from "zod"

/** "https://a.com/, http://localhost:5173" -> ["https://a.com", "http://localhost:5173"] */
export function parseOrigins(raw: string): string[] {
  return raw.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
}

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters`)

export const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
    CLIENT_URL: z.string().min(1).transform(parseOrigins).refine((o) => o.length > 0, "CLIENT_URL needs at least one origin"),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
    JWT_ACCESS_EXPIRES: z.string().regex(/^\d+[smh]$/, "use a form like 15m").default("15m"),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    path: ["JWT_REFRESH_SECRET"],
    message: "must differ from JWT_ACCESS_SECRET",
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
