import mongoose, { Mongoose } from "mongoose"
import {User} from "../models/user.model.js"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async ( req, res) =>{
    const currentUser= req.user?._id
    if(!currentUser){
        throw new ApiError(400, "No user found!")
    }

    const channelId = req.user._id

    const channelStats = await Video.aggregate([
        {
            $match : {
                owner : new Mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup : {
                from : "likes",
                localField : "_id",
                foreignField : "video",
                as : "likes"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "owner",
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $group : {
                _id : null,
                totalVideos : { $sum : 1},
                totalViews : { $sum : "$views" },
                totalLikes : { $sum : { $size : "$likes" } },
                totalSubscribers : { $first : { $size : "$subscribers" } }
            }
        },
        {
            $project : {
                _id : 0,
                totalVideos : 1,
                totalViews : 1,
                totalLikes : 1,
                totalSubscribers : 1
            }
        }
    ])

    let stats = channelStats[0]

    if(!stats){
        const subscriberCount = await subscriberCount.countDocuments({
            channel : channelId
        })

        stats = { 
            totalVideos : 0,
            totalViews : 0,
            totalLikes : 0,
            totalSubscribers : subscriberCount
        }
    }

    const additionalstats = await Video.aggregate([
        {
            $match : {
                owner : new mongoose.Type.ObjectId(channelStats)
            }
        },
        {
            $group : {
                _id: null,
                averageViews: { $avg: "$views" },
                mostViewedVideo: { $max: "$views" },
                totalDuration: { $sum: "$duration" }
            }
        }
    ])

    const additional = additionalStats[0] || {
        averageViews: 0,
        mostViewedVideo: 0,
        totalDuration: 0
    }
    
    const finalStats = {
        ...stats,
        averageViews: Math.round(additional.averageViews || 0),
        mostViewedVideo: additional.mostViewedVideo || 0,
        totalDuration: additional.totalDuration || 0,
        channel: {
            _id: currentUser._id,
            username: currentUser.username,
            fullName: currentUser.fullName,
            avatar: currentUser.avatar
        }
    }
    
    return res.status(200).json(
        new ApiResponse(200, finalStats, "Channel stats retrieved successfully")
    )
})