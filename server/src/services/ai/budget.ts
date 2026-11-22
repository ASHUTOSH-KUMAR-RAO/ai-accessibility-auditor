import { env } from "../../config/env.js"
import { prisma } from "../prisma.js"

const WINDOW_MS = 60 * 60 * 1000

export interface BudgetStatus {
  limit: number
  used: number
  remaining: number
  /** When the oldest counted generation leaves the window (null while nothing is counted) */
  resetAt: string | null
}

async function status(userId: string, db: Pick<typeof prisma, "aiUsage"> = prisma): Promise<BudgetStatus> {
  const since = new Date(Date.now() - WINDOW_MS)
  const [used, oldest] = await Promise.all([
    db.aiUsage.count({ where: { userId, createdAt: { gte: since } } }),
    db.aiUsage.findFirst({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ])
  return {
    limit: env.AI_RATE_LIMIT_PER_HOUR,
    used,
    remaining: Math.max(0, env.AI_RATE_LIMIT_PER_HOUR - used),
    resetAt: oldest ? new Date(oldest.createdAt.getTime() + WINDOW_MS).toISOString() : null,
  }
}
export const budgetStatus = (userId: string) => status(userId)

export type Spend = { ok: true; usageId: string } | { ok: false; limit: number; resetAt: string | null }

/** Reserves one paid AI generation for the user, atomically (two tabs cannot both slip under the limit). */
export async function spend(userId: string): Promise<Spend> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ai:" + userId}))`
    const s = await status(userId, tx)
    if (s.remaining <= 0) return { ok: false as const, limit: s.limit, resetAt: s.resetAt }
    const row = await tx.aiUsage.create({ data: { userId }, select: { id: true } })
    return { ok: true as const, usageId: row.id }
  })
}

/** The AI failed and the user got a guided fix instead: they don't pay for it. */
export const refund = (usageId: string) => prisma.aiUsage.deleteMany({ where: { id: usageId } }).then(() => undefined)
