import assert from "node:assert/strict"
import { connect } from "node:net"
import { after, before, describe, it } from "node:test"
import "../../config/env.js"
import { EGRESS_REFUSED_HEADER, startEgressProxy, type EgressProxy } from "./egress-proxy.js"
import { createGuard } from "./ssrf.js"

let proxy: EgressProxy

// Names resolve via a stub so the test needs no network.
const guard = createGuard({
  resolve: async (host) => {
    if (host === "rebind.example") return ["10.0.0.5"]
    if (host === "mixed.example") return ["93.184.216.34", "169.254.169.254"]
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" })
  },
})

/** Sends raw bytes to the proxy and returns the first response line + headers. */
const raw = (payload: string) =>
  new Promise<string>((resolve, reject) => {
    const s = connect({ host: "127.0.0.1", port: proxy.port })
    let data = ""
    s.on("data", (d) => {
      data += d.toString()
      if (data.includes("\r\n\r\n")) s.destroy()
    })
    s.on("close", () => resolve(data))
    s.on("error", reject)
    s.write(payload)
  })

before(async () => {
  proxy = await startEgressProxy(guard, { maxBytes: 1e9, onTooLarge: () => {} })
})
after(() => proxy.close())

describe("egress proxy refuses internal targets before connecting", () => {
  for (const target of ["127.0.0.1:443", "[::1]:443", "169.254.169.254:80", "10.0.0.1:443", "localhost:443", "rebind.example:443", "mixed.example:443", "example.com:8080", "93.184.216.34:22"]) {
    it(`CONNECT ${target} -> 403`, async () => {
      const res = await raw(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`)
      assert.match(res, /^HTTP\/1\.1 403/, res)
    })
  }

  it("plain http to the metadata service -> 403 with the refusal marker header", async () => {
    const res = await raw("GET http://169.254.169.254/latest/meta-data/ HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n")
    assert.match(res, /^HTTP\/1\.1 403/)
    assert.ok(res.toLowerCase().includes(`${EGRESS_REFUSED_HEADER}: refused`))
  })

  it("unresolvable names are counted as DNS failures, not blocks", async () => {
    const before = { ...proxy.stats }
    const res = await raw("CONNECT nowhere.example:443 HTTP/1.1\r\nHost: nowhere.example:443\r\n\r\n")
    assert.match(res, /^HTTP\/1\.1 502/)
    assert.equal(proxy.stats.dnsFailed, before.dnsFailed + 1)
    assert.equal(proxy.stats.blocked, before.blocked)
  })

  it("counts refusals", () => assert.ok(proxy.stats.blocked >= 10))
})
