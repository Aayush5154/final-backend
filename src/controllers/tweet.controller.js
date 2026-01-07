import mongoose, { isValidObjectId } from "mongoose";

import { asyncHandler } from "../utils/asyncHandler.js";
import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body

    const userId = req.user._id

    if (!content.trim()) {
        throw new ApiError(400, "Content field is required")
    }

    if (!userId) {
        throw new ApiError(400, "User not found")
    }

    const tweet = await Tweet.create({
        content,
        owner: userId
    })

    return res
        .status(201)
        .json(new ApiResponse(201, "tweet created successfully...", tweet))
})

export const getUserTweets = asyncHandler(async (req, res) => {

    const userId = req.user?._id

    if (!userId) {
        throw new ApiError(404, "user not found")
    }

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "tweetsDetails",
            },
        },
        {
            $unwind: "$tweetsDetails"
        },
        {
            $project: {
                username: "$tweetsDetails.username",
                avatar: "$tweetsDetails.avatar",
                createdAt: 1,
                updatedAt: 1,
                content: 1,
            },
        },
    ]);

    if (!tweets || tweets.length === 0) {
        throw new ApiError(404, "Tweet not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, tweets, "tweets fetched successfully!!"))

})

export const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const { content } = req.body

    if (!content.trim()) {
        throw new ApiError(400, "Content field is required");
    }
    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { content },
        { new: true }
    );

    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, "updated tweet successfully!!", tweet))
});

export const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetid } = req.params

    if (!isValidObjectId(tweetid)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetid)
    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    // Authorization check
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet")
    }

    await Tweet.findByIdAndDelete(tweetid)

    return res.status(200).json(
        new ApiResponse(200, {}, "Tweet deleted successfully")
    )
})


export const getAllTweets = asyncHandler(async (req, res) => {
    const tweets = await Tweet.find({})
        .populate("owner", "username fullname avatar")
        .sort({ createdAt: -1 })

    return res.status(200).json(
        new ApiResponse(200, tweets, "All tweets fetched successfully")
    )
})
