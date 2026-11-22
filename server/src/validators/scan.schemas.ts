import { z } from "zod"

/** Query strings send "" for an empty field: treat that as "not provided" instead of coercing it to 0 / failing an enum. */
const blank = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema)
const score = blank(z.coerce.number().int().min(0).max(100).optional())

export const createScanSchema = z.object({
  url: z.string().min(1, "Enter a website address").max(2048, "That address is too long"),
  viewport: z.enum(["DESKTOP", "MOBILE"]).default("DESKTOP"),
})

export const idParamSchema = z.object({ id: z.uuid() })
export const ruleParamSchema = z.object({ id: z.uuid(), ruleId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/) })

export const listScansQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: blank(z.uuid().optional()),
    status: blank(z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional()),
    viewport: blank(z.enum(["DESKTOP", "MOBILE"]).optional()),
    q: blank(z.string().trim().max(100).optional()),
    minScore: score,
    maxScore: score,
    sort: blank(z.enum(["date", "score"]).default("date")),
    order: blank(z.enum(["asc", "desc"]).default("desc")),
  })
  .refine((q) => q.minScore === undefined || q.maxScore === undefined || q.minScore <= q.maxScore, { message: "minScore must not exceed maxScore", path: ["minScore"] })

export const listIssuesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: blank(z.uuid().optional()),
  impact: blank(z.enum(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"]).optional()),
})

export const ruleNodesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: blank(z.uuid().optional()),
})
