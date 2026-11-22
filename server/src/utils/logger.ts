type Level = "debug" | "info" | "warn" | "error"

const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|database_url|direct_url/i

function redact(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
  if (depth > 4 || value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  )
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...(redact(meta) as object) })
  ;(level === "error" ? process.stderr : process.stdout).write(line + "\n")
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
}
