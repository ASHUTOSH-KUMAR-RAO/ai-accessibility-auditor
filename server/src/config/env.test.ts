import assert from "node:assert/strict"
import { test } from "node:test"

process.env.DATABASE_URL ??= "postgresql://x"
process.env.DIRECT_URL ??= "postgresql://x"
process.env.CLIENT_URL ??= "http://localhost:5173"
process.env.JWT_ACCESS_SECRET ??= "a".repeat(40)
process.env.JWT_REFRESH_SECRET ??= "b".repeat(40)

test("parseOrigins trims, drops trailing slashes and empties", async () => {
  const { parseOrigins } = await import("./env.js")
  assert.deepEqual(parseOrigins(" https://a.com/ ,http://localhost:5173,, https://b.io// "), [
    "https://a.com", "http://localhost:5173", "https://b.io",
  ])
})

test("env schema rejects identical JWT secrets", async () => {
  const { schema } = await import("./env.js")
  const same = "s".repeat(40)
  const r = schema.safeParse({ ...process.env, JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same })
  assert.equal(r.success, false)
})
