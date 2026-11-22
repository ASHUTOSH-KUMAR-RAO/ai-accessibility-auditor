import { z } from "zod"

export const createScanSchema = z.object({
  url: z.string().min(1, "Enter a website address").max(2048, "That address is too long"),
  viewport: z.enum(["DESKTOP", "MOBILE"]).default("DESKTOP"),
})

export const idParamSchema = z.object({ id: z.uuid() })

export const listScansQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
})

export const listIssuesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
  impact: z.enum(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"]).optional(),
})
