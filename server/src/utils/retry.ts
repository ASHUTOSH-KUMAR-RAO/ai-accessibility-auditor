import { logger } from "./logger.js"

/** Retries with exponential backoff — covers Supabase/Railway cold starts. */
export async function retry<T>(fn: () => Promise<T>, o: { attempts: number; baseDelayMs: number; label: string }): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= o.attempts) throw err
      const delay = o.baseDelayMs * 2 ** (i - 1)
      logger.warn(`${o.label} failed, retrying`, { attempt: i, delayMs: delay, reason: (err as Error).message })
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}
