import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { ScanError } from "./errors.js"

/**
 * SSRF guard. Rules, in order:
 *  1. Only http/https, no credentials, no whitespace/control characters, bounded length.
 *  2. Only ports 80 and 443.
 *  3. No internal-looking hostnames (localhost, *.internal, *.local, single-label names…).
 *  4. Every address the hostname resolves to must be a public, globally routable address
 *     (IPv4 deny-list, IPv6 allow-list of 2000::/3 minus special ranges, embedded IPv4 unwrapped).
 * The same check runs for the first URL, every redirect hop and every sub-request the page makes.
 */

export const MAX_URL_LENGTH = 2048
const ALLOWED_PORTS = new Set([80, 443])
const DNS_TIMEOUT_MS = 5_000
const DNS_CACHE_MS = 30_000

// ───────────── IPv4 ─────────────
const V4_BLOCKED: Array<[string, number]> = [
  ["0.0.0.0", 8],        // "this" network
  ["10.0.0.0", 8],       // private
  ["100.64.0.0", 10],    // CGNAT (also Alibaba metadata 100.100.100.200)
  ["127.0.0.0", 8],      // loopback
  ["169.254.0.0", 16],   // link-local (cloud metadata 169.254.169.254)
  ["172.16.0.0", 12],    // private
  ["192.0.0.0", 24],     // IETF protocol assignments
  ["192.0.2.0", 24],     // TEST-NET-1
  ["192.88.99.0", 24],   // 6to4 relay
  ["192.168.0.0", 16],   // private
  ["198.18.0.0", 15],    // benchmarking
  ["198.51.100.0", 24],  // TEST-NET-2
  ["203.0.113.0", 24],   // TEST-NET-3
  ["224.0.0.0", 4],      // multicast
  ["240.0.0.0", 4],      // reserved + broadcast
]

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    n = n * 256 + Number(p)
  }
  return n
}

const V4_RANGES = V4_BLOCKED.map(([base, bits]) => {
  const start = v4ToInt(base)!
  return { start, end: start + 2 ** (32 - bits) - 1 }
})

function isBlockedV4Int(n: number): boolean {
  return V4_RANGES.some((r) => n >= r.start && n <= r.end)
}

// ───────────── IPv6 ─────────────
function parseV6(input: string): bigint | null {
  let ip = input.replace(/^\[|\]$/g, "").split("%")[0]!.toLowerCase()
  if (isIP(ip) !== 6) return null

  // embedded dotted quad (::ffff:1.2.3.4) -> two hex groups
  const dot = ip.lastIndexOf(".")
  if (dot !== -1) {
    const colon = ip.lastIndexOf(":")
    const v4 = v4ToInt(ip.slice(colon + 1))
    if (v4 === null) return null
    ip = `${ip.slice(0, colon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`
  }

  const [head, tail] = ip.split("::")
  const headParts = head ? head.split(":") : []
  const tailParts = tail !== undefined && tail ? tail.split(":") : []
  const missing = 8 - headParts.length - tailParts.length
  if (ip.includes("::") ? missing < 0 : headParts.length !== 8) return null
  const groups = [...headParts, ...Array(ip.includes("::") ? missing : 0).fill("0"), ...tailParts]
  if (groups.length !== 8) return null

  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}

const inV6 = (n: bigint, base: bigint, bits: number) => n >> BigInt(128 - bits) === base >> BigInt(128 - bits)
const v6 = (s: string) => parseV6(s)!

// Inside 2000::/3 (global unicast) these sub-ranges are still not public internet.
const V6_SPECIAL_IN_GLOBAL: Array<[bigint, number]> = [
  [v6("2001::"), 23],     // IETF protocol assignments (Teredo 2001::/32, benchmarking, ORCHID…)
  [v6("2001:db8::"), 32], // documentation
  [v6("3fff::"), 20],     // documentation
]

function isBlockedV6(n: bigint): boolean {
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96): judge the embedded IPv4 address.
  if (n >> 32n === 0xffffn) return isBlockedV4Int(Number(n & 0xffffffffn))
  if (inV6(n, v6("64:ff9b::"), 96)) return isBlockedV4Int(Number(n & 0xffffffffn))

  // Allow-list: only 2000::/3 can be public. Everything else (::, ::1, fc00::/7, fe80::/10, ff00::/8, …) is blocked.
  if (!inV6(n, v6("2000::"), 3)) return true
  if (V6_SPECIAL_IN_GLOBAL.some(([base, bits]) => inV6(n, base, bits))) return true
  // 6to4 (2002::/16) embeds an IPv4 address in bits 16..48
  if (inV6(n, v6("2002::"), 16)) return isBlockedV4Int(Number((n >> 80n) & 0xffffffffn))
  return false
}

export function isBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "")
  const kind = isIP(clean)
  if (kind === 4) return isBlockedV4Int(v4ToInt(clean)!)
  if (kind === 6) {
    const n = parseV6(clean)
    return n === null ? true : isBlockedV6(n)
  }
  return true // not an IP at all: refuse
}

// ───────────── Hostnames ─────────────
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa", ".lan", ".intranet", ".corp", ".private"]

function isInternalHostname(host: string): boolean {
  return host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))
}

// ───────────── URL normalisation ─────────────
const NON_HTTP_SCHEME = /^(javascript|data|file|mailto|ftp|blob|about|view-source|tel|ws|wss):/i

export function normalizeUrl(input: string): { url: URL; normalized: string } {
  const raw = input.trim()
  if (!raw || raw.length > MAX_URL_LENGTH) throw new ScanError("INVALID_URL")
  // URL parsers silently drop tabs/newlines, which is a classic filter-bypass: refuse them outright.
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) throw new ScanError("INVALID_URL")
  if (NON_HTTP_SCHEME.test(raw)) throw new ScanError("INVALID_URL")

  let url: URL
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`)
  } catch {
    throw new ScanError("INVALID_URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ScanError("INVALID_URL")
  if (url.username || url.password) throw new ScanError("INVALID_URL", "Please remove the username and password from the address.")

  url.hash = ""
  url.hostname = url.hostname.replace(/\.+$/, "")
  if (!url.hostname) throw new ScanError("INVALID_URL")

  const host = url.hostname
  return { url, normalized: `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}${url.pathname}${url.search}` }
}

// ───────────── Guard ─────────────
export interface GuardOptions {
  /** Injectable for tests. Must return every A/AAAA address of the host. */
  resolve?: (host: string) => Promise<string[]>
  /** TESTS ONLY: exempt an exact origin (e.g. the local fixture server) from every check. Never wired to env. */
  allowOrigin?: (url: URL) => boolean
}

const defaultResolve = async (host: string) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address)

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), ms).unref())])

export function createGuard(options: GuardOptions = {}) {
  const resolve = options.resolve ?? defaultResolve
  const cache = new Map<string, { at: number; addrs: Promise<string[]> }>()

  const resolveCached = (host: string) => {
    const hit = cache.get(host)
    if (hit && Date.now() - hit.at < DNS_CACHE_MS) return hit.addrs
    const addrs = withTimeout(resolve(host), DNS_TIMEOUT_MS)
    cache.set(host, { at: Date.now(), addrs })
    addrs.catch(() => cache.delete(host))
    return addrs
  }

  /** Synchronous rules: scheme, port, hostname shape, IP literals. */
  function checkStatic(url: URL) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new ScanError("INVALID_URL")
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80
    if (!ALLOWED_PORTS.has(port)) throw new ScanError("BLOCKED_HOST")

    const host = url.hostname.replace(/\.+$/, "").toLowerCase()
    if (isIP(host.replace(/^\[|\]$/g, "")) !== 0) {
      if (isBlockedIp(host)) throw new ScanError("BLOCKED_HOST")
      return
    }
    if (!host.includes(".") || isInternalHostname(host)) throw new ScanError("BLOCKED_HOST")
  }

  return {
    normalize: normalizeUrl,
    checkStatic(url: URL) {
      if (options.allowOrigin?.(url)) return
      checkStatic(url)
    },

    /**
     * Full check incl. DNS. Returns the validated addresses so the caller can connect to exactly those IPs
     * (pinning: nothing is resolved a second time, which closes the DNS-rebinding window).
     */
    async resolvePublic(url: URL): Promise<string[]> {
      const host = url.hostname.replace(/\.+$/, "").toLowerCase()
      const bare = host.replace(/^\[|\]$/g, "")
      const literal = isIP(bare) !== 0
      if (options.allowOrigin?.(url)) return literal ? [bare] : lookupAll(host)
      checkStatic(url)
      if (literal) return [bare] // literal already vetted by checkStatic
      const addrs = await lookupAll(host)
      // If ANY answer is internal, refuse: an attacker-controlled name can mix public and private records.
      if (addrs.some(isBlockedIp)) throw new ScanError("BLOCKED_HOST")
      return addrs
    },

    async assertPublicUrl(url: URL): Promise<void> {
      await this.resolvePublic(url)
    },
  }

  async function lookupAll(host: string): Promise<string[]> {
    let addrs: string[]
    try {
      addrs = await resolveCached(host)
    } catch {
      throw new ScanError("DNS_FAILED")
    }
    if (addrs.length === 0) throw new ScanError("DNS_FAILED")
    return addrs
  }
}

export type Guard = ReturnType<typeof createGuard>
export const defaultGuard: Guard = createGuard()
