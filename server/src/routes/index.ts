import { Router } from "express"
import { getHealth } from "../controllers/health.controller.js"
import * as ai from "../controllers/ai.controller.js"
import { protect } from "../middlewares/protect.js"
import * as insights from "../controllers/insights.controller.js"
import * as share from "../controllers/share.controller.js"
import { badgeLimiter, publicLimiter } from "../middlewares/rateLimiter.js"
import { publicRouter } from "./public.routes.js"
import { authRouter } from "./auth.routes.js"
import { scanRouter } from "./scan.routes.js"

export const router = Router()
router.get("/health", getHealth)
router.use("/auth", authRouter)
router.use("/scans", scanRouter)
router.use("/public", publicLimiter, publicRouter)
router.get("/badge/:token.svg", badgeLimiter, share.badge)
router.get("/compare", protect, insights.compare)
router.get("/dashboard", protect, insights.dashboard)
router.get("/sites", protect, insights.sites)
router.get("/sites/:host", protect, insights.site)
router.get("/ai/status", protect, ai.aiStatus)
router.post("/ai-fixes/:id/feedback", protect, ai.aiFeedback)
