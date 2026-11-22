import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { env } from "../config/env.js"
import { PrismaClient } from "../generated/prisma/client.js"
import { logger } from "../utils/logger.js"
import { retry } from "../utils/retry.js"

const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(env.DATABASE_URL)

/** `?pgbouncer=true` is a Prisma-engine flag the `pg` driver does not understand: drop it. */
function connectionString() {
  const u = new URL(env.DATABASE_URL)
  u.searchParams.delete("pgbouncer")
  return u.toString()
}

// One small pool per instance, tuned for a managed pooler (Supabase / PgBouncer):
// - connect timeout so a cold or unreachable database fails fast instead of hanging a request
// - TCP keep-alive so idle connections are not silently dropped by NAT / the pooler
// - idle timeout shorter than the pooler's, so we close connections before it does
const pool = new pg.Pool({
  connectionString: connectionString(),
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  allowExitOnIdle: true, // idle sockets never keep a script or test process alive
  ssl: isLocal ? undefined : { rejectUnauthorized: false }, // Supabase terminates TLS with its own CA
})
// A dropped idle client emits "error" on the pool: unhandled, it would crash the process.
pool.on("error", (err) => logger.warn("Idle database connection dropped", { reason: err.message }))

const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"])
const TRANSIENT = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|Connection terminated|terminating connection|timeout exceeded when trying to connect|Client has encountered a connection error|P1001|P1002|P1017/i

/** Dropped connections: reads are retried once or twice with a short backoff. Writes are never retried (they are not idempotent). */
const base = new PrismaClient({ adapter: new PrismaPg(pool) })
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        if (!READS.has(operation)) return query(args)
        return retry(() => query(args), { attempts: 3, baseDelayMs: 250, label: `db ${operation}`, shouldRetry: (e) => TRANSIENT.test(String((e as Error)?.message ?? e)) })
      },
    },
  },
})

export const pingDb = () => retry(() => prisma.$queryRaw`SELECT 1`, { attempts: 4, baseDelayMs: 500, label: "db-ping" })

export async function connectDb() {
  await retry(() => prisma.$connect(), { attempts: 5, baseDelayMs: 1000, label: "db-connect" })
  logger.info("Database connected")
}

export async function disconnectDb() {
  await base.$disconnect()
  await pool.end().catch(() => {})
}
