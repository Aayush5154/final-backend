import { isValidObjectId } from "mongoose"
import { Video } from "../models/video.models.js"
import { VideoInsight } from "../models/videoinsight.models.js"
import { requestInsights } from "../services/insights.service.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoInsights = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId).select("_id owner").lean()
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const insight = await VideoInsight.findOne({ video: videoId }).lean()

    return res
        .status(200)
        .json(new ApiResponse(200, { insight, owner: video.owner }, "Video insights fetched successfully"))
})

const processVideoInsights = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId).select("_id owner")
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the video owner can generate AI insights")
    }

    const { insight, started } = await requestInsights(video, { force: req.body?.force === true })

    return res
        .status(started ? 202 : 200)
        .json(new ApiResponse(started ? 202 : 200, { insight, started }, started ? "AI insights queued" : "AI insights already up to date or in progress"))
})

export { getVideoInsights, processVideoInsights }
