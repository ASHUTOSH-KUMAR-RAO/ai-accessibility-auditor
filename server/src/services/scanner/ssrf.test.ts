import assert from "node:assert/strict"
import { describe, it } from "node:test"
import "../../config/env.js"
import { ScanError } from "./errors.js"
import { createGuard, isBlockedIp, normalizeUrl } from "./ssrf.js"

const code = async (fn: () => unknown | Promise<unknown>) => {
  try {
    await fn()
    return "OK"
  } catch (e) {
    return e instanceof ScanError ? e.code : `THROWN:${(e as Error).message}`
  }
}

const dns = (map: Record<string, string[] | Error>) =>
  createGuard({
    resolve: async (host) => {
      const v = map[host]
      if (!v) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" })
      if (v instanceof Error) throw v
      return v
    },
  })

describe("normalizeUrl", () => {
  it("adds https, drops fragment, lowercases host, strips trailing dot", () => {
    assert.equal(normalizeUrl("Example.COM./a?b=1#frag").normalized, "https://example.com/a?b=1")
    assert.equal(normalizeUrl("http://example.com").normalized, "http://example.com/")
  })
  it("rejects non-http schemes", async () => {
    for (const bad of ["file:///etc/passwd", "ftp://example.com", "javascript:alert(1)", "data:text/html,hi", "gopher://x.com", "ws://example.com", "view-source:https://example.com"]) {
      assert.equal(await code(() => normalizeUrl(bad)), "INVALID_URL", bad)
    }
  })
  it("rejects credentials, whitespace tricks, empty and oversized input", async () => {
    for (const bad of ["https://user:pw@example.com", "https://exa\nmple.com", "https://example.com\t.evil.com", "   ", "", `https://example.com/${"a".repeat(2100)}`]) {
      assert.equal(await code(() => normalizeUrl(bad)), "INVALID_URL", JSON.stringify(bad.slice(0, 40)))
    }
  })
})

describe("isBlockedIp", () => {
  const blocked = [
    "127.0.0.1", "127.255.255.254", "0.0.0.0", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "169.254.0.1", "100.64.0.1", "100.100.100.200", "100.127.255.255", "192.0.0.1", "192.0.2.5", "198.18.0.1",
    "198.51.100.7", "203.0.113.9", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "fe80::abcd%eth0", "fc00::1", "fd00:ec2::254", "fd12:3456::1", "ff02::1", "fec0::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "::ffff:10.0.0.1", "::127.0.0.1",
    "64:ff9b::7f00:1", "64:ff9b::a00:1", "64:ff9b:1::1", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2001:db8::1", "2001::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "[::1]", "not-an-ip",
  ]
  const allowed = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "100.128.0.1", "192.169.0.1", "223.255.255.254",
    "2606:4700:4700::1111", "2a00:1450:4001:81b::200e", "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"]

  for (const ip of blocked) it(`blocks ${ip}`, () => assert.equal(isBlockedIp(ip), true))
  for (const ip of allowed) it(`allows ${ip}`, () => assert.equal(isBlockedIp(ip), false))
})

describe("literal hosts are normalised by the URL parser, then blocked", () => {
  const g = dns({})
  for (const u of ["http://2130706433/", "http://0x7f000001/", "http://0x7f.1/", "http://017700000001/", "http://127.1/", "http://0/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://169.254.169.254/latest/meta-data/", "http://[fd00:ec2::254]/", "https://10.0.0.5/", "http://3232235777/"]) {
    it(`blocks ${u}`, async () => assert.equal(await code(() => g.assertPublicUrl(normalizeUrl(u).url)), "BLOCKED_HOST"))
  }
  it("allows a public IP literal", async () => assert.equal(await code(() => g.assertPublicUrl(normalizeUrl("https://93.184.216.34/").url)), "OK"))
})

describe("hostnames", () => {
  const g = dns({ "example.com": ["93.184.216.34"] })
  for (const u of ["http://localhost/", "http://LOCALHOST./", "http://app.localhost/", "http://printer.local/", "http://metadata.google.internal/", "http://db.railway.internal/", "http://intranet/", "http://router.lan/", "http://x.home.arpa/"]) {
    it(`blocks ${u}`, async () => assert.equal(await code(() => g.assertPublicUrl(normalizeUrl(u).url)), "BLOCKED_HOST"))
  }
})

describe("ports", () => {
  const g = dns({ "example.com": ["93.184.216.34"] })
  for (const [u, expected] of [
    ["http://example.com:80/", "OK"], ["https://example.com:443/", "OK"], ["http://example.com:443/", "OK"],
    ["http://example.com:8080/", "BLOCKED_HOST"], ["https://example.com:22/", "BLOCKED_HOST"], ["http://example.com:6379/", "BLOCKED_HOST"], ["https://example.com:8443/", "BLOCKED_HOST"],
  ] as const) it(`${u} -> ${expected}`, async () => assert.equal(await code(() => g.assertPublicUrl(normalizeUrl(u).url)), expected))
})

describe("DNS resolution", () => {
  it("allows names that resolve only to public addresses (v4 + v6)", async () => {
    const g = dns({ "ok.example": ["93.184.216.34", "2606:4700:4700::1111"] })
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://ok.example/"))), "OK")
  })
  it("blocks a name that resolves to a private address", async () => {
    const g = dns({ "evil.example": ["10.0.0.7"] })
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://evil.example/"))), "BLOCKED_HOST")
  })
  it("blocks when ANY answer is internal (mixed public + private records)", async () => {
    const g = dns({ "mixed.example": ["93.184.216.34", "169.254.169.254"] })
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://mixed.example/"))), "BLOCKED_HOST")
  })
  it("blocks names that resolve to IPv4-mapped / loopback IPv6", async () => {
    const g = dns({ "a.example": ["::ffff:127.0.0.1"], "b.example": ["::1"] })
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://a.example/"))), "BLOCKED_HOST")
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://b.example/"))), "BLOCKED_HOST")
  })
  it("reports DNS_FAILED for unknown names, errors and empty answers", async () => {
    const g = dns({ "empty.example": [], "boom.example": new Error("EAI_AGAIN") })
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://nope.example/"))), "DNS_FAILED")
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://empty.example/"))), "DNS_FAILED")
    assert.equal(await code(() => g.assertPublicUrl(new URL("https://boom.example/"))), "DNS_FAILED")
  })
})

describe("redirects and sub-requests are re-checked with the same guard", () => {
  // A page on a public host redirecting (or loading resources from) an internal target must be refused at that hop.
  const g = dns({ "public.example": ["93.184.216.34"], "rebind.example": ["127.0.0.1"] })
  it("public -> public passes", async () => assert.equal(await code(() => g.assertPublicUrl(new URL("https://public.example/next"))), "OK"))
  for (const hop of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://[::1]:80/", "http://10.1.2.3/", "http://localhost/", "https://rebind.example/", "http://public.example:8080/", "file:///etc/passwd"]) {
    it(`redirect hop to ${hop} is refused`, async () => {
      const r = await code(() => g.assertPublicUrl(new URL(hop)))
      assert.ok(r === "BLOCKED_HOST" || r === "INVALID_URL", r)
    })
  }
})

describe("pinning: resolvePublic returns exactly the validated addresses", () => {
  it("returns the addresses to connect to, so nothing is resolved a second time", async () => {
    const g = dns({ "ok.example": ["93.184.216.34", "2606:4700:4700::1111"] })
    assert.deepEqual(await g.resolvePublic(new URL("https://ok.example/")), ["93.184.216.34", "2606:4700:4700::1111"])
  })
  it("returns a public IP literal as-is and refuses private literals", async () => {
    const g = dns({})
    assert.deepEqual(await g.resolvePublic(new URL("https://93.184.216.34/")), ["93.184.216.34"])
    assert.equal(await code(() => g.resolvePublic(new URL("https://[::1]/"))), "BLOCKED_HOST")
  })
})
