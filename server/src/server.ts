import { app } from "./app.js"
import { env } from "./config/env.js"
import { connectDb, prisma } from "./services/prisma.js"
import { logger } from "./utils/logger.js"

const server = app.listen(env.PORT, () => logger.info("API listening", { port: env.PORT, env: env.NODE_ENV }))

// Do not block startup on the DB: /api/health reports its state and the platform decides.
connectDb().catch((err) => logger.error("Database unavailable at startup", { err }))

let closing = false
function shutdown(signal: string) {
  if (closing) return
  closing = true
  logger.info("Shutting down", { signal })
  setTimeout(() => process.exit(1), 10_000).unref()
  server.close(async () => {
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("unhandledRejection", (err) => logger.error("Unhandled rejection", { err }))
