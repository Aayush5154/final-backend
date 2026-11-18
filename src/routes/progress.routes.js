import { Router } from 'express';
import {
    getContinueWatching,
    removeWatchProgress,
    updateWatchProgress,
} from "../controllers/progress.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").get(getContinueWatching);
router.route("/:videoId")
    .put(updateWatchProgress)
    .delete(removeWatchProgress);

export default router
