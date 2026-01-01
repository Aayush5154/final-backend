import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    if (!userId) {
        throw new ApiError(401, "Unauthorized user")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    })

    let isLiked
    let message

    if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id })
        isLiked = false
        message = "Video unliked successfully"
    } else {
        await Like.create({
            video: videoId,
            likedBy: userId
        })
        isLiked = true
        message = "Video liked successfully"
    }

    return res.status(200).json(
        new ApiResponse(200, { isLiked }, message)
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    if (!userId) {
        throw new ApiError(401, "Unauthorized user")
    }

    const comment = await Comment.findById(commentId)
    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId
    })

    let isLiked
    let message

    if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id })
        isLiked = false
        message = "Comment unliked successfully"
    } else {
        await Like.create({
            comment: commentId,
            likedBy: userId
        })
        isLiked = true
        message = "Comment liked successfully"
    }

    return res.status(200).json(
        new ApiResponse(200, { isLiked }, message)
    )
})


const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    if (!userId) {
        throw new ApiError(401, "Unauthorized user")
    }

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    })

    let isLiked
    let message

    if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id })
        isLiked = false
        message = "Tweet unliked successfully"
    } else {
        await Like.create({
            tweet: tweetId,
            likedBy: userId
        })
        isLiked = true
        message = "Tweet liked successfully"
    }

    return res.status(200).json(
        new ApiResponse(200, { isLiked }, message)
    )
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    if (!userId) {
        throw new ApiError(401, "Unauthorized user")
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.max(parseInt(req.query.limit) || 10, 1)
    const skip = (page - 1) * limit

    const [result] = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $exists: true }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            thumbnail: 1,
                            duration: 1,
                            views: 1,
                            createdAt: 1,
                            owner: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                video: { $first: "$video" }
            }
        },
        {
            $match: {
                video: { $ne: null }
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ])

    const likedVideos = result?.data || []
    const total = result?.totalCount?.[0]?.count || 0

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                likedVideos,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            },
            "Liked videos retrieved successfully"
        )
    )
})


export {
    toggleVideoLike,
    toggleTweetLike,
    toggleCommentLike,
    getLikedVideos
}