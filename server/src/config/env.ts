import "dotenv/config"
import { z } from "zod"

/** "https://a.com/, http://localhost:5173" -> ["https://a.com", "http://localhost:5173"] */
/**
 * "https://a.com/, 'http://localhost:5173' ,https://b.io/app/" → ["https://a.com", "http://localhost:5173", "https://b.io"].
 * Whitespace, quotes, trailing slashes and paths are all forgiven (an Origin header never has them), so a typo in the
 * platform's env UI can not lock every browser out.
 */
export function parseOrigins(raw: string): string[] {
  const clean = raw.split(",").map((o) => o.trim().replace(/^["']+|["']+$/g, "").trim()).filter(Boolean)
  const origins = clean.map((o) => {
    try {
      const u = new URL(o)
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin // lower-cases the host, drops path / slash
    } catch {
      /* not a URL: fall through */
    }
    return o.replace(/\/+$/, "")
  })
  return [...new Set(origins)]
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
    // Connection pool per instance. Small on purpose: Supabase's pooler has a modest free-tier connection budget.
    DB_POOL_MAX: z.coerce.number().int().min(1).max(30).default(5),

    JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
    JWT_ACCESS_EXPIRES: z.string().regex(/^\d+[smh]$/, "use a form like 15m").default("15m"),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

    // Scan engine
    SCAN_WORKER_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
    // Chromium is memory hungry: one scan at a time in production unless you raise it on a bigger instance
    SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(process.env.NODE_ENV === "production" ? 1 : 2),
    SCAN_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10),
    SCAN_MAX_ACTIVE_PER_USER: z.coerce.number().int().min(1).default(2),
    SCAN_NAV_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
    SCAN_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(5000).default(60_000),
    SCAN_MAX_PAGE_BYTES: z.coerce.number().int().min(1_000_000).default(30_000_000),

    // AI fixes (Groq). Without a key the app runs in guided-fix (rule-based) mode.
    GROQ_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
    GROQ_MODEL_FAST: z.string().min(1).default("openai/gpt-oss-20b"),
    GROQ_MODEL_SMART: z.string().min(1).default("openai/gpt-oss-120b"),
    AI_TIMEOUT_MS: z.coerce.number().int().min(2000).default(25_000),
    AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(30),
    AI_MAX_CONCURRENT: z.coerce.number().int().min(1).max(16).default(4),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    path: ["JWT_REFRESH_SECRET"],
    message: "must differ from JWT_ACCESS_SECRET",
  })

// Safety net: the test runners must never touch a real database. Under `node --test` the app is pointed at the local
// Docker Postgres (TEST_DATABASE_URL), and anything that is not localhost is refused.
if (process.env.NODE_TEST_CONTEXT) {
  const test = process.env.TEST_DATABASE_URL
  const isLocal = (u?: string) => !!u && /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(u)
  if (!isLocal(test)) {
    console.error("Tests only run against a local database. Set TEST_DATABASE_URL (localhost) in server/.env.")
    process.exit(1)
  }
  process.env.DATABASE_URL = test
  process.env.DIRECT_URL = isLocal(process.env.TEST_DIRECT_URL) ? process.env.TEST_DIRECT_URL : test
}

const result = schema.safeParse(process.env)
if (!result.success) {
  // Fail fast; print variable names + reasons only, never values.
  const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
  console.error(`Invalid environment configuration:\n${lines.join("\n")}`)
  process.exit(1)
}

export const env = result.data
if (env.NODE_ENV === "production" && env.CLIENT_URL.some((o) => /localhost|127\.0\.0\.1/.test(o))) {
  console.warn("CLIENT_URL still contains a localhost origin: set it to your real frontend URL(s) in production.")
}
export const isProd = env.NODE_ENV === "production"
