import assert from "node:assert/strict"
import { test } from "node:test"

process.env.DATABASE_URL ??= "postgresql://x"
process.env.DIRECT_URL ??= "postgresql://x"
process.env.CLIENT_URL ??= "http://localhost:5173"

test("parseOrigins trims, drops trailing slashes and empties", async () => {
  const { parseOrigins } = await import("./env.js")
  assert.deepEqual(parseOrigins(" https://a.com/ ,http://localhost:5173,, https://b.io// "), [
    "https://a.com", "http://localhost:5173", "https://b.io",
  ])
})
