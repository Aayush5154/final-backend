import { Router } from "express"
import { getVideoInsights, processVideoInsights } from "../controllers/videoinsight.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.route("/:videoId").get(getVideoInsights)
router.route("/:videoId/process").post(verifyJWT, processVideoInsights)

export default router
