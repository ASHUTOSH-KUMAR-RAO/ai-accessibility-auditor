import { chromium, type Browser } from "playwright"
import { logger } from "../../utils/logger.js"

let browserPromise: Promise<Browser> | null = null

/** One shared Chromium process; every scan gets its own isolated context inside it. */
export function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium
    .launch({
      headless: true,
      proxy: { server: "per-context" }, // each scan supplies its own egress proxy
      args: [
        "--disable-dev-shm-usage", // small /dev/shm in containers
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        "--mute-audio",
        // WebRTC can open UDP sockets that request interception cannot see.
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    })
    .then((browser) => {
      browser.on("disconnected", () => {
        logger.warn("Chromium disconnected; it will be relaunched on the next scan")
        browserPromise = null
      })
      return browser
    })
    .catch((err) => {
      browserPromise = null
      logger.error("Could not launch Chromium. Run `npm run playwright:install` (or use the Docker image).", { err })
      throw err
    })
  return browserPromise
}

export async function closeBrowser() {
  const pending = browserPromise
  browserPromise = null
  if (pending) await (await pending.catch(() => null))?.close().catch(() => {})
}
