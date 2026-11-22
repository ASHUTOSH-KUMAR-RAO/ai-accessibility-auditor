const OTHER_SCHEME = /^(javascript|data|file|mailto|ftp|blob|about|view-source|tel):/i

export type UrlCheck = { ok: true; url: string } | { ok: false; message: string }

/** Friendly client-side check + https auto-prefix. The server re-validates everything (SSRF rules live there). */
export function checkUrlInput(raw: string): UrlCheck {
  const value = raw.trim()
  if (!value) return { ok: false, message: "Enter a website address, like example.com" }
  if (value.length > 2048) return { ok: false, message: "That address is too long" }
  if (/\s/.test(value)) return { ok: false, message: "Web addresses can't contain spaces" }
  if (OTHER_SCHEME.test(value)) return { ok: false, message: "Only http:// and https:// addresses can be scanned" }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`)
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, message: "Only http:// and https:// addresses can be scanned" }
    if (url.username || url.password) return { ok: false, message: "Remove the username and password from the address" }
    if (!url.hostname.includes(".") && !url.hostname.startsWith("[")) return { ok: false, message: "Enter a full address, like example.com" }
    return { ok: true, url: url.href }
  } catch {
    return { ok: false, message: "That doesn't look like a web address. Try something like example.com" }
  }
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
