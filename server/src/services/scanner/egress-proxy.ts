import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { connect, Socket, type AddressInfo } from "node:net"
import type { Duplex } from "node:stream"
import { ScanError } from "./errors.js"
import type { Guard } from "./ssrf.js"

/**
 * Per-scan forward proxy that Chromium is forced through.
 *
 * Why it exists: Playwright's route() sees the first request but NOT the hops of a redirect chain
 * (Chromium follows those internally), and a hostname can resolve differently the second time
 * (DNS rebinding). A proxy sees every connection the browser makes (redirects, sub-resources,
 * iframes, websockets) and connects only to IPs it has just validated, so there is no gap.
 */

export interface EgressStats {
  /** Connections refused by the SSRF guard. */
  blocked: number
  /** Connections refused because the name did not resolve. */
  dnsFailed: number
  /** Bytes received from the internet through the proxy. */
  bytes: number
}

export interface EgressProxy {
  port: number
  stats: EgressStats
  close(): Promise<void>
}

const CONNECT_TIMEOUT_MS = 15_000
const IDLE_TIMEOUT_MS = 30_000
/** Plain-http refusals look like a normal 403/502 to the browser; this header lets scan-page tell them apart. */
export const EGRESS_REFUSED_HEADER = "x-accesslens-egress"
const HOP_BY_HOP = ["connection", "proxy-connection", "proxy-authorization", "keep-alive", "te", "trailer", "transfer-encoding", "upgrade"]

/** A guard refusal (403). A name that simply doesn't resolve is a 502, not a security event. */
const isRefusal = (err: unknown) => err instanceof ScanError && err.code !== "DNS_FAILED"

export async function startEgressProxy(guard: Guard, opts: { maxBytes: number; onTooLarge: () => void }): Promise<EgressProxy> {
  const stats: EgressStats = { blocked: 0, dnsFailed: 0, bytes: 0 }
  const sockets = new Set<Duplex>()
  const track = <T extends Duplex>(s: T) => {
    sockets.add(s)
    s.once("close", () => sockets.delete(s))
    if (s instanceof Socket) s.setTimeout(IDLE_TIMEOUT_MS, () => s.destroy())
    return s
  }

  /** Validates host:port and returns the exact public IPs we are allowed to connect to. */
  async function vet(host: string, port: number): Promise<string[]> {
    try {
      const bracketed = host.includes(":") ? `[${host}]` : host
      return await guard.resolvePublic(new URL(`${port === 443 ? "https" : "http"}://${bracketed}:${port}/`))
    } catch (err) {
      if (err instanceof ScanError && err.code === "DNS_FAILED") stats.dnsFailed++
      else stats.blocked++
      throw err
    }
  }

  /** Connect to the first validated address that answers. */
  async function dial(addrs: string[], port: number): Promise<Socket> {
    let last: unknown
    for (const host of addrs) {
      try {
        return await new Promise<Socket>((resolve, reject) => {
          const s = connect({ host, port, timeout: CONNECT_TIMEOUT_MS })
          s.once("connect", () => {
            s.setTimeout(0)
            resolve(s)
          })
          s.once("timeout", () => s.destroy(new Error("connect timeout")))
          s.once("error", reject)
        })
      } catch (err) {
        last = err
      }
    }
    throw last ?? new Error("no address")
  }

  const count = (chunk: Buffer, ...toClose: Duplex[]) => {
    stats.bytes += chunk.length
    if (stats.bytes > opts.maxBytes) {
      opts.onTooLarge()
      toClose.forEach((s) => s.destroy())
    }
  }

  const server: Server = createServer()

  // ── HTTPS (and any TLS/tunnelled traffic): CONNECT host:port ──
  server.on("connect", (req: IncomingMessage, client: Duplex, head: Buffer) => {
    track(client)
    client.on("error", () => {})
    void (async () => {
      const m = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(req.url ?? "")
      if (!m) return void client.end("HTTP/1.1 400 Bad Request\r\n\r\n")
      const host = (m[1] ?? m[2])!
      const port = Number(m[3])
      try {
        const addrs = await vet(host, port)
        const upstream = track(await dial(addrs, port))
        upstream.on("error", () => client.destroy())
        client.on("close", () => upstream.destroy())
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        if (head.length) upstream.write(head)
        upstream.on("data", (chunk: Buffer) => count(chunk, upstream, client))
        upstream.pipe(client)
        client.pipe(upstream)
      } catch (err) {
        client.end(`HTTP/1.1 ${isRefusal(err) ? "403 Forbidden" : "502 Bad Gateway"}\r\n\r\n`)
      }
    })()
  })

  // ── Plain http://: absolute-form request line ──
  server.on("request", (req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      let target: URL
      try {
        target = new URL(req.url ?? "")
        if (target.protocol !== "http:") throw new Error("not http")
      } catch {
        res.writeHead(400).end()
        return
      }
      try {
        const addrs = await vet(target.hostname.replace(/^\[|\]$/g, ""), Number(target.port || 80))
        const headers = { ...req.headers }
        for (const h of HOP_BY_HOP) delete headers[h]
        const upstream = httpRequest(
          { host: addrs[0], port: Number(target.port || 80), method: req.method, path: target.pathname + target.search, headers, timeout: IDLE_TIMEOUT_MS, agent: false },
          (up) => {
            const outHeaders = { ...up.headers }
            for (const h of HOP_BY_HOP) delete outHeaders[h]
            res.writeHead(up.statusCode ?? 502, outHeaders)
            up.on("data", (chunk: Buffer) => count(chunk, up.socket, res.socket as Duplex))
            up.pipe(res)
          },
        )
        upstream.on("timeout", () => upstream.destroy())
        upstream.on("error", () => (res.headersSent ? res.destroy() : res.writeHead(502, { [EGRESS_REFUSED_HEADER]: "unreachable" }).end()))
        req.pipe(upstream)
      } catch (err) {
        res.writeHead(isRefusal(err) ? 403 : 502, { [EGRESS_REFUSED_HEADER]: isRefusal(err) ? "refused" : "unreachable" }).end()
      }
    })()
  })

  server.on("connection", (s) => track(s))
  server.on("clientError", (_e, socket) => socket.destroy())

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve) // loopback only, random port, lives for one scan
  })

  return {
    port: (server.address() as AddressInfo).port,
    stats,
    async close() {
      sockets.forEach((s) => s.destroy())
      await new Promise<void>((r) => server.close(() => r()))
    },
  }
}

