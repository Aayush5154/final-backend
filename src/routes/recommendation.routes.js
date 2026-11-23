import { Router } from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { getRecommendedVideos } from "../controllers/recommendation.controller.js"

const router = Router()

router.use(verifyJWT)
router.route("/").get(getRecommendedVideos)

export default router
