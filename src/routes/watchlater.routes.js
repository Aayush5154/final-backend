import { Router } from 'express';
import {
    addToWatchLater,
    getWatchLaterVideos,
    removeFromWatchLater,
} from "../controllers/watchlater.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").get(getWatchLaterVideos);
router.route("/:videoId").post(addToWatchLater).delete(removeFromWatchLater);

export default router
