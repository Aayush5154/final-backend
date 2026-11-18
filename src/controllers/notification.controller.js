import { isValidObjectId } from "mongoose"
import { Notification } from "../models/notification.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user?._id
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50)
    const skip = (page - 1) * limit

    const filter = { recipient: userId }
    if (req.query.unread === "true") {
        filter.isRead = false
    }

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "username fullname avatar")
            .populate("video", "title thumbnail")
            .populate("comment", "content"),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: userId, isRead: false })
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                notifications,
                unreadCount,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            },
            "Notifications fetched successfully"
        )
    )
})

const getUnreadNotificationCount = asyncHandler(async (req, res) => {
    const unreadCount = await Notification.countDocuments({
        recipient: req.user?._id,
        isRead: false
    })

    return res
        .status(200)
        .json(new ApiResponse(200, { unreadCount }, "Unread notification count fetched successfully"))
})

const markNotificationRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params

    if (!isValidObjectId(notificationId)) {
        throw new ApiError(400, "Invalid notification ID")
    }

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: req.user?._id },
        { $set: { isRead: true } },
        { new: true }
    )

    if (!notification) {
        throw new ApiError(404, "Notification not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, notification, "Notification marked as read"))
})

const markAllNotificationsRead = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        { recipient: req.user?._id, isRead: false },
        { $set: { isRead: true } }
    )

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { modifiedCount: result.modifiedCount },
                "All notifications marked as read"
            )
        )
})

export {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
}
