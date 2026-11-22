// Run with: npx tsx --test src/lib/safe-text.test.ts (from client/, using the server's tsx if needed)
import assert from "node:assert/strict"
import { test } from "node:test"
import { isSafeUrl, linkify } from "./safe-text.ts"
import { diffLines, formatHtml } from "./diff.ts"

test("only w3.org and deque.com links become clickable", () => {
  const segs = linkify("See https://www.w3.org/WAI/WCAG22/Understanding/ and https://evil.example/x, also https://deque.com.evil.io/a.")
  assert.deepEqual(segs.filter((s) => s.type === "link").map((s) => s.text), ["https://www.w3.org/WAI/WCAG22/Understanding/"])
  assert.ok(!isSafeUrl("http://w3.org/")) // https only
  assert.ok(!isSafeUrl("javascript:alert(1)"))
  assert.ok(!isSafeUrl("https://notw3.org/"))
  assert.ok(isSafeUrl("https://dequeuniversity.com/x") === false)
  assert.ok(isSafeUrl("https://dequeuniversity.deque.com/x"))
})
test("diff marks only the added attribute", () => {
  const d = diffLines(formatHtml('<img src="a.png">'), formatHtml('<img src="a.png" alt="x">'))
  assert.deepEqual(d.filter((l) => l.kind !== "same").map((l) => `${l.kind}:${l.text.trim()}`), ['add:alt="x"'])
})
