// Every table in `public` must have Row Level Security enabled (see the enable_rls migration).
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { prisma } from "./services/prisma.js"

after(() => prisma.$disconnect())

describe("row level security", () => {
  it("is enabled on every table", async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    assert.ok(rows.length >= 10, "expected the app tables")
    assert.deepEqual(rows.filter((r) => !r.rowsecurity).map((r) => r.tablename), [], "tables without RLS: add ENABLE ROW LEVEL SECURITY to the migration that created them")
  })
})
