export type Segment = { type: "text"; text: string } | { type: "link"; text: string; href: string }

/** Only these hosts (and their subdomains) may become clickable inside AI text. */
const SAFE_HOSTS = ["w3.org", "deque.com"]

export function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === "https:" && SAFE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * AI text is never HTML. URLs in it are plain text unless they point at w3.org or deque.com.
 * Returns segments for React to render as text nodes and <a> elements, never as markup.
 */
export function linkify(text: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) })
    out.push(isSafeUrl(m[0]) ? { type: "link", text: m[0], href: m[0] } : { type: "text", text: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) })
  return out
}
