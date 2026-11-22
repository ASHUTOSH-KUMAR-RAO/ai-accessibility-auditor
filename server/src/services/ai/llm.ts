import Groq from "groq-sdk"
import type { z } from "zod"
import { env } from "../../config/env.js"
import { logger } from "../../utils/logger.js"
import { Semaphore } from "../../utils/semaphore.js"

export type LlmFailure = "no_key" | "timeout" | "rate_limit" | "server" | "bad_output" | "aborted"
export class LlmError extends Error {
  constructor(public readonly kind: LlmFailure, message: string) {
    super(message)
    this.name = "LlmError"
  }
}

export interface Message { role: "system" | "user" | "assistant"; content: string }
export interface LlmRequest {
  model: string
  messages: Message[]
  maxTokens: number
  signal: AbortSignal
  /** JSON Schema for constrained decoding (strict). Omit for plain json_object mode. */
  jsonSchema?: { name: string; schema: object }
  /** Receives raw content deltas (streaming). Omit for a plain request. */
  onDelta?: (text: string) => void
}
/** Returns the full text of the reply. Swapped for a fake in tests. */
export type Transport = (req: LlmRequest) => Promise<string>

export const llmConfig = { backoffMs: 600, retries: 2, maxRetryAfterMs: 5000, limitedForMs: 60_000 }

/** Max simultaneous calls to the provider, across fixes and summaries. */
const slots = new Semaphore(env.AI_MAX_CONCURRENT)

let client: Groq | null = null
const groqTransport: Transport = async (req) => {
  client ??= new Groq({ apiKey: env.GROQ_API_KEY, maxRetries: 0 }) // retries are ours: we also want to react to Retry-After
  const base = {
    model: req.model,
    messages: req.messages,
    temperature: 0.2,
    max_completion_tokens: req.maxTokens,
    reasoning_effort: "low" as const, // gpt-oss reasons first; low keeps latency and cost down for structured tasks
    response_format: req.jsonSchema
      ? { type: "json_schema" as const, json_schema: { name: req.jsonSchema.name, strict: true, schema: req.jsonSchema.schema as Record<string, unknown> } }
      : { type: "json_object" as const },
  }
  if (!req.onDelta) {
    const r = await client.chat.completions.create(base, { signal: req.signal })
    return r.choices[0]?.message?.content ?? ""
  }
  const stream = await client.chat.completions.create({ ...base, stream: true }, { signal: req.signal })
  let text = ""
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      text += delta
      req.onDelta(delta)
    }
  }
  return text
}

/** undefined = real Groq (when a key exists); null = no key; function = fake. */
let override: Transport | null | undefined
export const setTransport = (t: Transport | null | undefined) => void (override = t)
const transport = (): Transport | null => (override !== undefined ? override : env.GROQ_API_KEY ? groqTransport : null)

// ── health: after an upstream failure we skip the AI for a minute and serve guided fixes straight away ──
let limitedUntil = 0
export const resetLlmHealth = () => void (limitedUntil = 0)
export function aiStatus() {
  const configured = transport() !== null
  return { configured, limited: configured && Date.now() < limitedUntil, models: { fast: env.GROQ_MODEL_FAST, smart: env.GROQ_MODEL_SMART } }
}
export const aiUsable = () => {
  const s = aiStatus()
  return s.configured && !s.limited
}

type HttpError = Error & { status?: number; headers?: Record<string, string> | Headers; error?: { error?: { code?: string } } }
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new LlmError("aborted", "Cancelled"))), { once: true })
  })
const header = (e: HttpError, name: string) => (e.headers instanceof Headers ? e.headers.get(name) : e.headers?.[name]) ?? null

function classify(err: unknown, userSignal: AbortSignal): LlmError {
  if (err instanceof LlmError) return err
  if (userSignal.aborted) return new LlmError("aborted", "Cancelled")
  const e = err as HttpError
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || e?.name === "APIUserAbortError" || /timed? ?out/i.test(e?.message ?? "")) return new LlmError("timeout", "The AI took too long")
  // constrained decoding refused its own output (e.g. a missing key): same as invalid JSON, handled by the corrective retry
  if (e?.status === 400 && e.error?.error?.code === "json_validate_failed") return new LlmError("bad_output", "The AI returned an invalid answer")
  if (e?.status === 429) return new LlmError("rate_limit", "The AI provider is rate limiting us")
  if (e?.status === undefined || e.status >= 500 || e.status === 408) return new LlmError("server", "The AI provider is unavailable")
  return new LlmError("server", `The AI provider rejected the request (${e.status})`)
}

/** One completion with timeout and exponential backoff on 429 / 5xx / network errors. Never logs prompts or replies. */
export async function complete(req: LlmRequest): Promise<string> {
  const send = transport()
  if (!send) throw new LlmError("no_key", "AI is not configured")
  for (let attempt = 0; ; attempt++) {
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(env.AI_TIMEOUT_MS)])
    try {
      return await slots.run(() => send({ ...req, signal }))
    } catch (raw) {
      const err = classify(raw, req.signal)
      const retryAfter = Number(header(raw as HttpError, "retry-after")) * 1000
      const retryable = err.kind === "rate_limit" || err.kind === "server"
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : llmConfig.backoffMs * 2 ** attempt
      if (!retryable || attempt >= llmConfig.retries || wait > llmConfig.maxRetryAfterMs) {
        if (err.kind !== "aborted" && err.kind !== "bad_output") {
          limitedUntil = Date.now() + llmConfig.limitedForMs
          logger.warn("AI call failed", { kind: err.kind, model: req.model, attempts: attempt + 1 })
        }
        throw err
      }
      logger.warn("AI call failed, retrying", { kind: err.kind, model: req.model, attempt: attempt + 1, delayMs: wait })
      await sleep(wait, req.signal)
    }
  }
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("no JSON object in reply")
  return JSON.parse(text.slice(start, end + 1))
}

/** Strict JSON: validated with zod; one corrective retry, then LlmError("bad_output"). */
export async function completeJson<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<z.output<S>> {
  const messages = [...req.messages]
  let problem = ""
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = ""
    try {
      text = await complete({ ...req, messages, onDelta: attempt === 0 ? req.onDelta : undefined })
    } catch (e) {
      if (!(e instanceof LlmError && e.kind === "bad_output")) throw e
      problem = "the reply did not match the required JSON schema (every key is required)"
      messages.push({ role: "user", content: `Your previous reply was rejected: ${problem}. Reply again with ONLY the complete JSON object.` })
      continue
    }
    try {
      const parsed = schema.safeParse(parseJson(text))
      if (parsed.success) {
        limitedUntil = 0
        return parsed.data
      }
      problem = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
    } catch (e) {
      problem = `reply was not valid JSON (${(e as Error).message})`
    }
    // The bad reply is NOT echoed back: it may carry text from the page.
    messages.push({ role: "user", content: `Your previous reply was rejected: ${problem}. Reply again with ONLY the corrected JSON object.` })
  }
  logger.warn("AI returned invalid output twice", { model: req.model, problem })
  throw new LlmError("bad_output", "The AI returned an invalid answer")
}

/**
 * Pulls the value of the top-level "explanation" string out of a JSON reply that is still arriving,
 * calling `emit` with each newly decoded piece of text.
 */
export function explanationStreamer(emit: (text: string) => void) {
  let buf = ""
  let pos = -1 // next unread index inside the string value; -1 until the key is seen
  let done = false
  const ESC: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" }
  return (chunk: string) => {
    if (done) return
    buf += chunk
    if (pos < 0) {
      const m = /"explanation"\s*:\s*"/.exec(buf)
      if (!m) return
      pos = m.index + m[0].length
    }
    let out = ""
    while (pos < buf.length) {
      const c = buf[pos]!
      if (c === '"') {
        done = true
        break
      }
      if (c === "\\") {
        const n = buf[pos + 1]
        if (n === undefined) break // escape split across chunks: wait
        if (n === "u") {
          if (pos + 6 > buf.length) break
          out += String.fromCharCode(parseInt(buf.slice(pos + 2, pos + 6), 16) || 63)
          pos += 6
        } else {
          out += ESC[n] ?? n
          pos += 2
        }
      } else {
        out += c
        pos++
      }
    }
    if (out) emit(out)
  }
}
