import { Router } from "express"
import * as ctrl from "../controllers/auth.controller.js"
import { originCheck } from "../middlewares/originCheck.js"
import { protect } from "../middlewares/protect.js"
import { loginLimiter, registerLimiter } from "../middlewares/rateLimiter.js"
import { validateBody } from "../middlewares/validate.js"
import { loginSchema, registerSchema } from "../validators/auth.schemas.js"

export const authRouter = Router()

authRouter.post("/register", registerLimiter, validateBody(registerSchema), ctrl.register)
authRouter.post("/login", loginLimiter, validateBody(loginSchema), ctrl.login)
// Cookie-authenticated endpoints get the CSRF Origin check.
authRouter.post("/refresh", originCheck, ctrl.refresh)
authRouter.post("/logout", originCheck, ctrl.logout)
authRouter.get("/me", protect, ctrl.me)
