import type { Server as HttpServer } from "node:http"
import { Server } from "socket.io"
import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"
import { logger } from "../utils/logger.js"
import { verifyAccessToken } from "./token.service.js"

export type ScanEvent = "scan:queued" | "scan:progress" | "scan:completed" | "scan:failed" | "scan:cancelled"

let io: Server | null = null

/** Socket.io on the same HTTP server. Handshake carries the access token; each user joins room user:<id>. */
export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true }, // same comma-separated list as the REST API
    serveClient: false,
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (typeof token !== "string") return next(new Error("UNAUTHENTICATED"))
    try {
      socket.data.userId = verifyAccessToken(token)
      next()
    } catch (err) {
      next(new Error(err instanceof AppError ? err.code : "INVALID_TOKEN")) // TOKEN_EXPIRED lets the client refresh and retry
    }
  })

  io.on("connection", (socket) => {
    void socket.join(`user:${socket.data.userId}`)
  })
  logger.info("Realtime ready")
  return io
}

export function emitToUser(userId: string, event: ScanEvent, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload)
}

export async function closeRealtime() {
  const current = io
  io = null
  if (current) await new Promise<void>((resolve) => void current.close(() => resolve()))
}
