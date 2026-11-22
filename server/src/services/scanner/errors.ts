export const SCAN_ERROR_CODES = [
  "INVALID_URL",
  "BLOCKED_HOST",
  "DNS_FAILED",
  "TIMEOUT",
  "SITE_UNREACHABLE",
  "PAGE_TOO_LARGE",
  "SCAN_FAILED",
] as const
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number]

/** User-safe copy. Raw browser/network errors are logged server-side and never shown. */
export const SCAN_ERROR_MESSAGES: Record<ScanErrorCode, string> = {
  INVALID_URL: "That doesn't look like a valid web address. Try something like https://example.com",
  BLOCKED_HOST: "We can only scan public websites. Localhost, private networks and unusual ports aren't allowed.",
  DNS_FAILED: "We couldn't find that website. Check the spelling of the address.",
  TIMEOUT: "The scan took too long and was stopped. The page may be very slow or very heavy.",
  SITE_UNREACHABLE: "We couldn't reach that website. It may be down, or it may block automated visitors.",
  PAGE_TOO_LARGE: "That page is too large to scan.",
  SCAN_FAILED: "Something went wrong while scanning that page. Please try again.",
}

export class ScanError extends Error {
  constructor(
    public readonly code: ScanErrorCode,
    /** Safe to show to the user. Defaults to the canned message for the code. */
    message: string = SCAN_ERROR_MESSAGES[code],
  ) {
    super(message)
    this.name = "ScanError"
  }
}

/** Thrown when the user (or a shutdown) stopped a scan; not a failure. */
export class ScanCancelled extends Error {
  constructor() {
    super("Scan cancelled")
    this.name = "ScanCancelled"
  }
}

export type AbortKind = "cancelled" | "shutdown" | "timeout"

/** Why an AbortSignal fired: we abort with a string reason, AbortSignal.timeout() uses a TimeoutError. */
export function abortKind(signal: AbortSignal): AbortKind | null {
  if (!signal.aborted) return null
  const r = signal.reason
  if (r === "cancelled" || r === "shutdown") return r
  return "timeout"
}
