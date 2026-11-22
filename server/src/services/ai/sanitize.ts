// Page HTML is untrusted and may hold personal data. Everything is cleaned and truncated before it leaves the server.

const MAX_ATTR = 160
const MAX_TEXT = 200
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

/** Removes scripts, handlers, data: URIs, query strings/tokens, input values and control characters; truncates the rest. */
export function sanitizeHtml(html: string, maxLength = 1500): string {
  let out = html
    .replace(CONTROL, "")
    .replace(/<script\b[\s\S]*?(<\/script\s*>|$)/gi, "<script></script>")
    .replace(/<style\b[\s\S]*?(<\/style\s*>|$)/gi, "<style></style>")
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "") // inline event handlers
    .replace(/\s+(value|nonce|integrity|srcdoc)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "") // user input, tokens
    .replace(/data:[^"')\s>]*/gi, "data:[removed]")
    .replace(/(?:java|vb)script\s*:[^">]*/gi, "#") // a javascript: href would be copied into the fix and (rightly) refused
    .replace(/((?:https?:)?\/\/[^"'\s?#>]+)[?#][^"'\s>]*/gi, "$1") // ?token=… and #fragments
    .replace(/\s([a-z-:]+)\s*=\s*"([^"]*)"/gi, (_m, name: string, v: string) => ` ${name}="${v.length > MAX_ATTR ? v.slice(0, MAX_ATTR) + "…" : v}"`)
    .replace(/>([^<]{200,})</g, (_m, t: string) => `>${t.trim().slice(0, MAX_TEXT)}…<`)
    .replace(/\s+/g, " ")
    .trim()
  if (out.length > maxLength) out = out.slice(0, maxLength) + " …"
  return out
}

/** axe's failure summary quotes colours, ids and text from the page: clean it the same way and cap it. */
export function sanitizeText(text: string, maxLength = 800): string {
  const clean = text.replace(CONTROL, "").replace(/[ \t]+/g, " ").trim()
  return clean.length > maxLength ? clean.slice(0, maxLength) + " …" : clean
}
