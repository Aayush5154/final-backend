import { Router } from 'express';
import {
    getNotifications,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
} from "../controllers/notification.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").get(getNotifications);
router.route("/unread-count").get(getUnreadNotificationCount);
router.route("/read-all").patch(markAllNotificationsRead);
router.route("/:notificationId/read").patch(markNotificationRead);

export default router
