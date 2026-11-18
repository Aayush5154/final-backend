import { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.models.js"
import { TweetComment } from "../models/tweetcomment.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { emitToTweetViewers } from "../socket/index.js"

const OWNER_FIELDS = "username fullname avatar"
const MAX_COMMENT_LENGTH = 1000

const getTweetComments = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId).select("_id")
    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    const comments = await TweetComment.find({ tweet: tweetId })
        .sort({ createdAt: 1 })
        .limit(200)
        .populate("owner", OWNER_FIELDS)

    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Tweet comments fetched successfully"))
})

const addTweetComment = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const { content, parent } = req.body

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    if (!content || !content.trim()) {
        throw new ApiError(400, "Comment content is required")
    }

    if (content.trim().length > MAX_COMMENT_LENGTH) {
        throw new ApiError(400, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`)
    }

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    let parentComment = null
    if (parent) {
        if (!isValidObjectId(parent)) {
            throw new ApiError(400, "Invalid parent comment ID")
        }

        parentComment = await TweetComment.findById(parent)
        if (!parentComment || parentComment.tweet.toString() !== tweetId) {
            throw new ApiError(400, "Parent comment does not belong to this tweet")
        }
    }

    const comment = await TweetComment.create({
        content: content.trim(),
        tweet: tweetId,
        owner: req.user?._id,
        parent: parentComment?._id || null
    })

    const createdComment = await TweetComment.findById(comment._id)
        .populate("owner", OWNER_FIELDS)

    emitToTweetViewers("tweet:comment:new", createdComment)

    return res
        .status(201)
        .json(new ApiResponse(201, createdComment, "Comment added successfully"))
})

export {
    getTweetComments,
    addTweetComment
}
