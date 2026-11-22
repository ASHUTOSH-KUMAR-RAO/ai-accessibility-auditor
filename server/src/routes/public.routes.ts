import { Router } from "express"
import * as share from "../controllers/share.controller.js"

/** Everything under /api/public/:token is anonymous and read-only. The token itself is the credential. */
export const publicRouter = Router({ mergeParams: true })
publicRouter.get("/:token/report", share.publicReport)
publicRouter.get("/:token/screenshot", share.publicScreenshot)
publicRouter.get("/:token/rules/:ruleId/nodes", share.publicNodes)
publicRouter.get("/:token/ai-summary", share.publicSummary)
publicRouter.get("/:token/keyboard", share.publicKeyboard)
publicRouter.get("/:token/issues/:issueId/ai-fix", share.publicFix)
