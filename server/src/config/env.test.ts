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

test("parseOrigins forgives quotes, paths, case and duplicates", async () => {
  const { parseOrigins } = await import("./env.js")
  assert.deepEqual(parseOrigins(`"https://App.Example.com/", 'https://app.example.com' , https://b.io/some/path/?x=1`), ["https://app.example.com", "https://b.io"])
  assert.deepEqual(parseOrigins("localhost:5173/"), ["localhost:5173"]) // not a URL: only the slash goes
})

test("scan concurrency defaults to 2 in development and honours an override (production default is 1)", async () => {
  const { schema } = await import("./env.js")
  assert.equal(schema.parse({ ...process.env, NODE_ENV: "development", SCAN_CONCURRENCY: undefined }).SCAN_CONCURRENCY, 2)
  assert.equal(schema.parse({ ...process.env, NODE_ENV: "development", SCAN_CONCURRENCY: "3" }).SCAN_CONCURRENCY, 3)
})

test("env schema rejects identical JWT secrets", async () => {
  const { schema } = await import("./env.js")
  const same = "s".repeat(40)
  const r = schema.safeParse({ ...process.env, JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same })
  assert.equal(r.success, false)
})
