import { Router } from "express"
import { getVideoChat, askVideoQuestion } from "../controllers/videochat.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.use(verifyJWT)
router.route("/:videoId").get(getVideoChat)
router.route("/:videoId/messages").post(askVideoQuestion)

export default router
