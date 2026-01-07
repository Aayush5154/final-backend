import mongoose from "mongoose"
import { Video } from "../models/video.models.js"
import { User } from "../models/user.models.js"
import { Comment } from "../models/comment.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!mongoose.isValidObjectId(videoId)) {// ye sirf formatting check karta hain 
        throw new ApiError(400, "Invalid video Id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video does not exists")
    }

    const commentsAggregate = Comment.aggregate([
        {
            $match: { video: new mongoose.Types.ObjectId(videoId) }
        },
        {
            $lookup: {
                from: "users",
                localFields: "owner",
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
            $sort: { createdAt: 1 }
        }
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }

    const comments = await Comment.aggregatePaginate(commentsAggregate, options)

    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Comments retreived successfully"))
})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Comment content is required")
    }

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Id or formatting")
    }

    const currentUser = await User.findById(req.user?._id)
    if (!currentUser) {
        throw new ApiError(400, "User not found")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video not found")
    }

    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user?._id
    })// sirf owner and video ki id store hui h pure objects nahi 

    if (!comment) {
        throw new ApiError(500, "Failed to create comment")
    }
    // ab yaha sirf ek single user ke baar me baat ho rhi or vo bhi hame pata h kon hain.
    const createdComment = await Comment.findById(comment._id).populate("owner", "username fullname avatar")

    return res
        .status(201)
        .json(new ApiResponse(201, createdComment, "Comment added successfully"))

})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment Id")
    }

    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Comment content is required")
    }

    const currentUser = await User.findById(req.user?._id)

    if (!currentUser) {
        throw new ApiError(404, "User not found")
    }

    const comment = await Comment.findById(commentId)
    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not autherized to updated this content")
    }

    const updatedContent = await Comment.findByIdAndUpdate(
        commentId,
        { content: content.trim() },
        { new: true }
    ).populate("owner", "username fullname avatar")

    return res.
        status(200)
        .json(new ApiResponse(200, updatedContent, "Comment updated successfully"))
})


const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this comment")
    }// vese to pehle bhi jwtVerify kar liya h par still 

    await comment.deleteOne()

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Comment deleted successfully"))
})


export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}