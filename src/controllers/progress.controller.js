import { isValidObjectId } from "mongoose"
import { WatchProgress } from "../models/watchprogress.models.js"
import { VideoDailyStat } from "../models/videodailystat.models.js"
import { Video } from "../models/video.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const MAX_WATCH_TIME_DELTA = 120 // seconds; ignores large forward seeks

const updateWatchProgress = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user?._id
    const progressInput = Number(req.body?.progress)
    const durationInput = Number(req.body?.duration)

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    if (!Number.isFinite(progressInput) || progressInput < 0) {
        throw new ApiError(400, "A valid progress value is required")
    }

    const video = await Video.findById(videoId).select("_id owner duration")
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const duration = Number.isFinite(durationInput) && durationInput > 0
        ? durationInput
        : video.duration || 0

    const progress = duration > 0
        ? Math.min(progressInput, duration)
        : progressInput

    const completed = duration > 0 && progress >= duration - 2

    const previousProgress = await WatchProgress.findOne({ owner: userId, video: videoId })

    const savedProgress = await WatchProgress.findOneAndUpdate(
        { owner: userId, video: videoId },
        { $set: { progress, duration, completed } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    // Track watch time for analytics only for other users' videos and for real playback
    if (!completed && video.owner.toString() !== userId.toString()) {
        const delta = previousProgress ? progress - previousProgress.progress : 0
        if (delta > 0) {
            const watchedSeconds = Math.min(delta, MAX_WATCH_TIME_DELTA)
            const date = new Date().toISOString().slice(0, 10)

            await VideoDailyStat.updateOne(
                { video: videoId, date },
                { $inc: { watchTime: watchedSeconds }, $setOnInsert: { owner: video.owner } },
                { upsert: true }
            )
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(200, savedProgress, "Watch progress saved successfully"))
})

const getContinueWatching = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    const entries = await WatchProgress.find({
        owner: userId,
        completed: false,
        progress: { $gt: 5 }
    })
        .sort({ updatedAt: -1 })
        .limit(20)
        .populate({
            path: "video",
            match: { isPublished: true },
            populate: {
                path: "owner",
                select: "username fullname avatar"
            }
        })

    const continueWatching = entries.filter((entry) => entry.video)

    return res
        .status(200)
        .json(new ApiResponse(200, continueWatching, "Continue watching list fetched successfully"))
})

export {
    updateWatchProgress,
    getContinueWatching
}
