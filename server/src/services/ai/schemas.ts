import { z } from "zod"

/** Bump when prompts or output shape change: it is part of the cache key. */
export const PROMPT_VERSION = 1

// AI output is code the user may paste into their site: refuse anything that executes or loads remote content.
const UNSAFE_HTML = /<\s*(script|iframe|object|embed|link|meta\s+http-equiv)\b|javascript\s*:|\son[a-z]+\s*=|srcdoc\s*=/i
const UNSAFE_CSS = /@import|url\s*\(|expression\s*\(|javascript\s*:|<\s*\/?\s*style/i
const UNSAFE_JSX = /<\s*script\b|dangerouslySetInnerHTML|javascript\s*:/i

export const isSafeHtml = (s: string) => !UNSAFE_HTML.test(s)

export const testStep = z.object({
  method: z.enum(["keyboard", "screen-reader", "contrast", "visual"]),
  text: z.string().min(3).max(300),
})

/** What the model must return for one element. */
export const fixOutputSchema = z.object({
  explanation: z.string().min(10).max(900),
  fixedHtml: z.string().min(1).max(4000).refine(isSafeHtml, { error: (iss) => `fixedHtml contains unsafe markup: ${UNSAFE_HTML.exec(String(iss.input))?.[0]}` }),
  cssFix: z.string().max(2000).refine((s) => !UNSAFE_CSS.test(s), "cssFix contains unsafe CSS").nullish(),
  jsx: z.string().max(4000).refine((s) => !UNSAFE_JSX.test(s), "jsx contains unsafe code").nullish(),
  steps: z.array(z.string().min(3).max(300)).min(2).max(5),
  test: z.array(testStep).min(1).max(4),
  wcag: z.array(z.string().regex(/^\d\.\d\.\d{1,2}$/)).max(6).nullish(),
  confidence: z.enum(["high", "medium", "low"]),
})
export type FixOutput = z.infer<typeof fixOutputSchema>

export const effortSchema = z.enum(["quick", "medium", "large"])
export type Effort = z.infer<typeof effortSchema>

export const summaryOutputSchema = z.object({
  verdict: z.string().min(10).max(600),
  priorities: z
    .array(z.object({ ruleId: z.string().max(100).nullish(), title: z.string().min(3).max(140), why: z.string().min(5).max(400), effort: effortSchema }))
    .min(1)
    .max(3),
  quickWins: z.array(z.string().min(3).max(200)).max(4),
  mostAffected: z.string().min(5).max(400),
})
export type SummaryOutput = z.infer<typeof summaryOutputSchema>

/** What the API returns and the cache stores. */
export interface FixContent {
  explanation: string
  fixedHtml: string | null
  cssFix: string | null
  jsx: string | null
  steps: string[]
  test: Array<z.infer<typeof testStep>>
  /** WCAG success criteria ids ("1.4.3"); the API adds names */
  wcag: string[]
  confidence: "high" | "medium" | "low"
  effort: Effort
}

export type VerificationStatus = "VERIFIED" | "NOT_VERIFIED" | "NOT_APPLICABLE"
export interface Verification {
  status: VerificationStatus
  note: string
}

// ── Constrained decoding: Groq guarantees these shapes for the gpt-oss models (strict mode: every key required, no extras). ──
const str = { type: "string" }
const nullableStr = { type: ["string", "null"] }
const strict = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties })
export const FIX_JSON_SCHEMA = strict({
  explanation: str,
  fixedHtml: str,
  cssFix: nullableStr,
  jsx: nullableStr,
  steps: { type: "array", items: str },
  test: { type: "array", items: strict({ method: { type: "string", enum: ["keyboard", "screen-reader", "contrast", "visual"] }, text: str }) },
  wcag: { type: "array", items: str },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
})
export const SUMMARY_JSON_SCHEMA = strict({
  verdict: str,
  priorities: { type: "array", items: strict({ ruleId: nullableStr, title: str, why: str, effort: { type: "string", enum: ["quick", "medium", "large"] } }) },
  quickWins: { type: "array", items: str },
  mostAffected: str,
})
