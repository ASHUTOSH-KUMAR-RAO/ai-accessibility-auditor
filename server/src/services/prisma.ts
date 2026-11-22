import { PrismaPg } from "@prisma/adapter-pg"
import { env } from "../config/env.js"
import { PrismaClient } from "../generated/prisma/client.js"
import { logger } from "../utils/logger.js"
import { retry } from "../utils/retry.js"

/** Single shared client (pooled DATABASE_URL). */
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })

export const pingDb = () => retry(() => prisma.$queryRaw`SELECT 1`, { attempts: 4, baseDelayMs: 500, label: "db-ping" })

export async function connectDb() {
  await retry(() => prisma.$connect(), { attempts: 5, baseDelayMs: 1000, label: "db-connect" })
  logger.info("Database connected")
}
