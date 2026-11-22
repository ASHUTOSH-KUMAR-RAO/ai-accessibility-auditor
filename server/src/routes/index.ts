import { Router } from "express"
import { getHealth } from "../controllers/health.controller.js"
import * as ai from "../controllers/ai.controller.js"
import { protect } from "../middlewares/protect.js"
import { authRouter } from "./auth.routes.js"
import { scanRouter } from "./scan.routes.js"

export const router = Router()
router.get("/health", getHealth)
router.use("/auth", authRouter)
router.use("/scans", scanRouter)
router.get("/ai/status", protect, ai.aiStatus)
router.post("/ai-fixes/:id/feedback", protect, ai.aiFeedback)
