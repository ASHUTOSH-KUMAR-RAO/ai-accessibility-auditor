import { Router } from "express"
import * as ctrl from "../controllers/scan.controller.js"
import * as ai from "../controllers/ai.controller.js"
import { protect } from "../middlewares/protect.js"

export const scanRouter = Router()

scanRouter.use(protect) // every scan route is private; services additionally scope queries by userId
scanRouter.post("/", ctrl.create)
scanRouter.get("/", ctrl.list)
scanRouter.get("/stats", ctrl.stats) // before "/:id"
scanRouter.get("/:id", ctrl.get)
scanRouter.get("/:id/report", ctrl.report)
scanRouter.get("/:id/rules/:ruleId/nodes", ctrl.ruleNodes)
scanRouter.get("/:id/issues", ctrl.issues)
scanRouter.get("/:id/screenshot", ctrl.screenshot)
scanRouter.post("/:id/issues/:issueId/ai-fix", ai.aiFix)
scanRouter.get("/:id/ai-summary", ai.getAiSummary)
scanRouter.post("/:id/ai-summary", ai.aiSummary)
scanRouter.post("/:id/rescan", ctrl.rescan)
scanRouter.post("/:id/cancel", ctrl.cancel)
scanRouter.delete("/:id", ctrl.remove)
