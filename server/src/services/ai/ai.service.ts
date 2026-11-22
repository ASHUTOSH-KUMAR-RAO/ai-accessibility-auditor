import { AppError } from "../../utils/AppError.js"
import { prisma } from "../prisma.js"
import { budgetStatus } from "./budget.js"
import type { FixIssue } from "./fix.service.js"
import { aiStatus } from "./llm.js"

/** The issue must belong to a live scan of this user. */
export async function loadIssue(userId: string, scanId: string, issueId: string): Promise<FixIssue> {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, scanId, scan: { userId, deletedAt: null } },
    select: { id: true, ruleId: true, help: true, description: true, wcagTags: true, html: true, failureSummary: true },
  })
  if (!issue) throw new AppError("Issue not found", 404, "NOT_FOUND")
  return issue
}

export async function feedback(userId: string, aiFixId: string, input: { helpful: boolean; reason?: string }) {
  if (!(await prisma.aiFix.findUnique({ where: { id: aiFixId }, select: { id: true } }))) throw new AppError("AI fix not found", 404, "NOT_FOUND")
  const data = { helpful: input.helpful, reason: input.helpful ? null : input.reason?.trim() || null }
  await prisma.aiFixFeedback.upsert({ where: { aiFixId_userId: { aiFixId, userId } }, create: { aiFixId, userId, ...data }, update: data })
}

export async function status(userId: string) {
  return { ...aiStatus(), budget: await budgetStatus(userId) }
}
