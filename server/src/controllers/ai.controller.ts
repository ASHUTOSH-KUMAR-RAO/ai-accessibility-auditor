import type { Request, Response } from "express"
import { z } from "zod"
import * as ai from "../services/ai/ai.service.js"
import { generateFix } from "../services/ai/fix.service.js"
import { LlmError } from "../services/ai/llm.js"
import { generateSummary, getSummary } from "../services/ai/summary.service.js"
import { AppError } from "../utils/AppError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { sendSuccess } from "../utils/response.js"
import { idParamSchema } from "../validators/scan.schemas.js"

const userId = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHENTICATED")
  return req.user.id
}
const params = z.object({ id: z.uuid(), issueId: z.uuid() })
const feedbackBody = z.object({ helpful: z.boolean(), reason: z.string().trim().max(500).optional() })
const summaryBody = z.object({ regenerate: z.boolean().default(false) }).default({ regenerate: false })

/** Aborts when the client goes away (cancel button, closed tab) so we stop paying for the generation. */
function abortOnClose(req: Request, res: Response) {
  const ac = new AbortController()
  res.on("close", () => !res.writableFinished && ac.abort())
  req.on("aborted", () => ac.abort())
  return ac.signal
}

const wantsStream = (req: Request) => req.headers.accept?.includes("text/event-stream") ?? false

/**
 * POST /scans/:id/issues/:issueId/ai-fix
 * JSON by default. With `Accept: text/event-stream` the explanation is streamed as it is written:
 *   event: status {phase}   event: delta {text}   event: result {…}   event: error {code,message}
 */
export const aiFix = asyncHandler(async (req, res) => {
  const { id, issueId } = params.parse(req.params)
  const uid = userId(req)
  const issue = await ai.loadIssue(uid, id, issueId) // 404 before any streaming starts
  const signal = abortOnClose(req, res)
  res.setHeader("Cache-Control", "no-store")

  if (!wantsStream(req)) return void sendSuccess(res, await generateFix(uid, issue, { signal }))

  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" })
  const send = (event: string, data: unknown) => {
    if (res.writableEnded) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    ;(res as Response & { flush?: () => void }).flush?.()
  }
  try {
    const result = await generateFix(uid, issue, { signal, onGenerating: () => send("status", { phase: "generating" }), onDelta: (text) => send("delta", { text }) })
    send("result", result)
  } catch (err) {
    if (!(err instanceof LlmError && err.kind === "aborted")) send("error", { code: err instanceof AppError ? err.code : "INTERNAL_ERROR", message: err instanceof AppError ? err.message : "Could not create the fix." })
  }
  res.end()
})

export const getAiSummary = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { summary: await getSummary(userId(req), idParamSchema.parse(req.params).id) })
})

export const aiSummary = asyncHandler(async (req, res) => {
  const { regenerate } = summaryBody.parse(req.body)
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, { summary: await generateSummary(userId(req), idParamSchema.parse(req.params).id, { regenerate, signal: abortOnClose(req, res) }) })
})

export const aiStatus = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  sendSuccess(res, await ai.status(userId(req)))
})

export const aiFeedback = asyncHandler(async (req, res) => {
  await ai.feedback(userId(req), idParamSchema.parse(req.params).id, feedbackBody.parse(req.body))
  sendSuccess(res, null, "Thanks for the feedback")
})
