import { createServer } from "node:http"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { connectDb, prisma } from "./services/prisma.js"
import { closeRealtime, initRealtime } from "./services/realtime.js"
import { closeBrowser } from "./services/scanner/browser.js"
import { scanWorker } from "./services/scan-worker.js"
import { logger } from "./utils/logger.js"

const server = createServer(app)
initRealtime(server)
server.listen(env.PORT, () => logger.info("API listening", { port: env.PORT, env: env.NODE_ENV, scanWorker: env.SCAN_WORKER_ENABLED }))

// Do not block startup on the DB: /api/health reports its state and the platform decides.
connectDb()
  .then(() => (env.SCAN_WORKER_ENABLED ? scanWorker.start() : undefined))
  .catch((err) => logger.error("Database unavailable at startup", { err }))

let closing = false
async function shutdown(signal: string) {
  if (closing) return
  closing = true
  logger.info("Shutting down", { signal })
  setTimeout(() => process.exit(1), 25_000).unref()
  server.close() // stop accepting new HTTP connections
  await scanWorker.stop(10_000) // let running scans finish, else hand them back to the queue
  await closeRealtime()
  await closeBrowser()
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("unhandledRejection", (err) => logger.error("Unhandled rejection", { err }))
