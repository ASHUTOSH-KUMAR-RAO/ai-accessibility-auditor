import compression from "compression"
import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import { env } from "./config/env.js"
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js"
import { apiLimiter } from "./middlewares/rateLimiter.js"
import { router } from "./routes/index.js"
import { logger } from "./utils/logger.js"

export const app = express()

app.set("trust proxy", env.TRUST_PROXY)
app.disable("x-powered-by")

app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(compression())
app.use(
  morgan(
    (tokens, req, res) =>
      JSON.stringify({
        method: tokens.method?.(req, res),
        path: tokens.url?.(req, res)?.split("?")[0], // never log query strings
        status: Number(tokens.status?.(req, res)),
        ms: Number(tokens["response-time"]?.(req, res)),
      }),
    { stream: { write: (line) => logger.info("request", JSON.parse(line)) } },
  ),
)
app.use(express.json({ limit: "100kb" }))
app.use(cookieParser())
app.use("/api", apiLimiter, router)

app.use(notFoundHandler)
app.use(errorHandler)

