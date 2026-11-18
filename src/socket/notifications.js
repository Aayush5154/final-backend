import { Notification } from "../models/notification.models.js"
import { emitToUser } from "./index.js"

// Pushes saved notifications to each recipient's personal room with the same
// populated shape the REST endpoint returns, so clients can render them directly.
const emitNotifications = async (notifications) => {
    try {
        const ids = (notifications ?? []).map((notification) => notification?._id).filter(Boolean)
        if (!ids.length) return

        const populatedList = await Notification.find({ _id: { $in: ids } })
            .populate("sender", "username fullname avatar")
            .populate("video", "title thumbnail")
            .populate("comment", "content")
            .lean()

        populatedList.forEach((notification) => {
            emitToUser(notification.recipient, "notification:new", notification)
        })
    } catch (error) {
        console.error("Failed to emit notifications:", error)
    }
}

const emitNotification = (notification) => emitNotifications([notification])

export { emitNotification, emitNotifications }
