import { isValidObjectId } from "mongoose"
import { WatchLater } from "../models/watchlater.models.js"
import { Video } from "../models/video.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const addToWatchLater = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    await WatchLater.updateOne(
        { owner: userId, video: videoId },
        { $setOnInsert: { owner: userId, video: videoId } },
        { upsert: true }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, { isInWatchLater: true }, "Video added to Watch Later"))
})

const removeFromWatchLater = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    await WatchLater.deleteOne({ owner: userId, video: videoId })

    return res
        .status(200)
        .json(new ApiResponse(200, { isInWatchLater: false }, "Video removed from Watch Later"))
})

const getWatchLaterVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    const entries = await WatchLater.find({ owner: userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({
            path: "video",
            populate: {
                path: "owner",
                select: "username fullname avatar"
            }
        })

    const videos = entries
        .filter((entry) => entry.video)
        .map((entry) => ({
            ...entry.video.toObject(),
            addedToWatchLaterAt: entry.createdAt
        }))

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Watch Later videos fetched successfully"))
})

export {
    addToWatchLater,
    removeFromWatchLater,
    getWatchLaterVideos
}
