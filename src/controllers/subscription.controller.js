import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async(req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channel ID");
    }

    const currentUser= await User.findById(req.user?._id)

    if(!currentUser){
        throw new ApiError(404, "Unauthorized access!!")
    }

    const channel = await User.findById(channelId)
    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    if(channelId == req.user?._id.toString()){
        throw new ApiError(400, "You cannot subscribe to own channel")
    }

    const existingSubscription = await Subscription.findone({
        subscriber: req.user?._id,
        channel: channelId
    })

    let message
    let isSubscribed 

    if(existingSubscription){
        await Subscription.findByIdAndDelete(existingSubscription._id)
        message = "Unsubscribed successfully"
        isSubscribed = false
    }else {
        await Subscription.create({
            subscriber : req.user?._id,
            channel : channelId
        })
        message = "Subscribed successfully!!"
        isSubscribed = true
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200 , { isSubscribed }, message)
    )

})

const getUserChannelSubscribers = asyncHandler(async(req, res) => {
    const {channelId} = req.params

     if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }
    
    // Check if channel exists
    const channel = await User.findById(channelId)
    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const subscribers = await Subscription.aggregate([
        {
            $match : {channel : new mongoose.Types.ObjectId(channelId)}
        },
        {
            $lookup : {
                from : "users",
                localField : "subscriber",
                foreignField: "_id",
                as: "subscriberDetails",
                pipeline: [
                    {
                         $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $project: {
                subscriberDetails: 0,
                channel: 0
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        }   
    ])
    const totalSubscribers = await Subscription.countDocuments({ channel: channelId })
    
    return res.status(200).json(
        new ApiResponse(200, {
            subscribers,
            channel: {
                _id: channel._id,
                username: channel.username,
                fullName: channel.fullName,
                avatar: channel.avatar
            },
            pagination: {
                page,
                limit,
                total: totalSubscribers,
                pages: Math.ceil(totalSubscribers / limit)
            }
        }, "Channel subscribers retrieved successfully")
    )
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    // Validate subscriberId
    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID")
    }
    
    // Check if subscriber exists
    const subscriber = await User.findById(subscriberId)
    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found")
    }
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    
    // Aggregation pipeline to get subscribed channels with their details
    const subscribedChannels = await Subscription.aggregate([
        {
            $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) }
        },
        {
            $lookup: {// durse collection se related data laana 
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channelDetails",// ek naya field jodoge channelDetails 

//  Usme sirf channel ka ID pada hai.
//  Tumhe us channel ka naam, avatar, username chahiye
                // {
//   "_id": "sub1",
//   "subscriber": "userA",
//   "channel": "userB"
//   "channelDetails": [
//     {
//       "_id": "userB",
//       "username": "techguru",
//       "avatar": "img.png"
//     }
//   ]
// }
            pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }// subscription model se vo saare chaanel layo jiska subscriber ye user hain (as $ match)
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$subscribers" }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            subscribersCount: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                channel: { $first: "$channelDetails" }
            }
        },
        {
            $project: {
                channelDetails: 0,
                subscriber: 0
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        }
    ])
    
    // Get total count for pagination
    const totalSubscriptions = await Subscription.countDocuments({ subscriber: subscriberId })
    
    return res.status(200).json(
        new ApiResponse(200, {
            subscribedChannels,
            subscriber: {
                _id: subscriber._id,
                username: subscriber.username,
                fullName: subscriber.fullName,
                avatar: subscriber.avatar
            },
            pagination: {
                page,
                limit,
                total: totalSubscriptions,
                pages: Math.ceil(totalSubscriptions / limit)
            }
        }, "Subscribed channels retrieved successfully")
    )
})


export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}