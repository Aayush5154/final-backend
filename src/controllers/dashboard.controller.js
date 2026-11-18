import mongoose, { Mongoose } from "mongoose"
import { User } from "../models/user.models.js"
import { Video } from "../models/video.models.js"
import { Subscription } from "../models/subscription.models.js"
import { Like } from "../models/like.models.js"
import { Comment } from "../models/comment.models.js"
import { VideoDailyStat } from "../models/videodailystat.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const getChannelStats = asyncHandler(async (req, res) => {
    const currentUser = req.user?._id
    if (!currentUser) {
        throw new ApiError(400, "No user found!")
    }

    const channelId = req.user._id

    const channelStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }// Filters only videos uploaded by this channel.
        },
        {
            $lookup: {// Ye lookup har video ke saare likes utha ke us video ke andar daal deta hai
                // Is video ke niche likh do kaun-kaun like kar chuka hain  
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner",// Video model me localfield owner h 
                // samjhe ?? batau -> Video model me owner h subscriber kuch nhai or jo owner h vahi channel h to soch video model usme -> channel/owner then subscription model me jitne bhi same channel hain h vo subscriber count dega.(unko ek arrayme store)
                //Video → owner → subscriptions → subscribers
                foreignField: "channel",
                as: "subscribers"
            }
            //Is video ke owner (channel) ko jitne logon ne subscribe kiya hai,
            // un sabko nikaal ke subscribers naam ke array me daal do
        },
        {
            //"Mujhe sab videos ka ek hi result chahiye"  ->>>>>>> Ye kaam group karta hai
            $group: {
                _id: null,//Sab documents ko ek hi group me daal do
                totalVideos: { $sum: 1 },// Har video ke liye 1 add kar do
                totalViews: { $sum: "$views" },// Sab videos ke views jod do
                totalLikes: { $sum: { $size: "$likes" } },// array me array h to
                totalSubscribers: { $first: { $size: "$subscribers" } }// Sirf pehle video ka subscriber count le lo baaki ignore kar do (nahi to repeat honge).
            }
        },
        {
            $project: {
                _id: 0,
                totalVideos: 1,
                totalViews: 1,
                totalLikes: 1,
                totalSubscribers: 1
            }
        }
    ])

    let stats = channelStats[0]

    if (!stats) {
        const subscriberCount = await Subscription.countDocuments({
            channel: channelId
        })

        stats = {
            totalVideos: 0,
            totalViews: 0,
            totalLikes: 0,
            totalSubscribers: subscriberCount
        }
    }

    const additionalstats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $group: {
                _id: null,
                averageViews: { $avg: "$views" },
                mostViewedVideo: { $max: "$views" },
                totalDuration: { $sum: "$duration" }
            }
        }
    ])

    const additional = additionalstats[0] || {
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

export const getChannelAnalytics = asyncHandler(async (req, res) => {
    const channelId = req.user?._id
    const channelObjectId = new mongoose.Types.ObjectId(channelId)

    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 30)
    const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 4, 1), 12)
    const totalDays = days + (weeks - 1) * 7

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const since = new Date(today)
    since.setUTCDate(since.getUTCDate() - (totalDays - 1))
    const sinceKey = since.toISOString().slice(0, 10)

    const videos = await Video.find({ owner: channelObjectId }).select("_id views").lean()
    const videoIds = videos.map((video) => video._id)

    const [statRows, likeRows, commentRows, watchTimeRows, totalLikes, totalComments] = await Promise.all([
        VideoDailyStat.aggregate([
            { $match: { owner: channelObjectId, date: { $gte: sinceKey } } },
            {
                $group: {
                    _id: "$date",
                    views: { $sum: "$views" },
                    watchTime: { $sum: "$watchTime" }
                }
            }
        ]),
        videoIds.length
            ? Like.aggregate([
                { $match: { video: { $in: videoIds }, createdAt: { $gte: since } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ])
            : [],
        videoIds.length
            ? Comment.aggregate([
                { $match: { video: { $in: videoIds }, createdAt: { $gte: since } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ])
            : [],
        VideoDailyStat.aggregate([
            { $match: { owner: channelObjectId } },
            { $group: { _id: null, watchTime: { $sum: "$watchTime" } } }
        ]),
        videoIds.length ? Like.countDocuments({ video: { $in: videoIds } }) : 0,
        videoIds.length ? Comment.countDocuments({ video: { $in: videoIds } }) : 0
    ])

    const dayMap = new Map()
    for (let i = totalDays - 1; i >= 0; i -= 1) {
        const day = new Date(today)
        day.setUTCDate(today.getUTCDate() - i)
        const key = day.toISOString().slice(0, 10)
        dayMap.set(key, { date: key, views: 0, watchTime: 0, likes: 0, comments: 0 })
    }

    statRows.forEach((row) => {
        const entry = dayMap.get(row._id)
        if (entry) {
            entry.views = row.views
            entry.watchTime = row.watchTime
        }
    })

    likeRows.forEach((row) => {
        const entry = dayMap.get(row._id)
        if (entry) entry.likes = row.count
    })

    commentRows.forEach((row) => {
        const entry = dayMap.get(row._id)
        if (entry) entry.comments = row.count
    })

    const dailyList = Array.from(dayMap.values())
    const todayMs = today.getTime()

    const weeklyMap = new Map()
    dailyList.forEach((day) => {
        const daysAgo = Math.floor((todayMs - new Date(`${day.date}T00:00:00Z`).getTime()) / 86400000)
        const bucket = Math.floor(daysAgo / 7)

        if (bucket >= weeks) return

        if (!weeklyMap.has(bucket)) {
            weeklyMap.set(bucket, {
                weekStart: day.date,
                views: 0,
                watchTime: 0,
                likes: 0,
                comments: 0
            })
        }

        const week = weeklyMap.get(bucket)
        week.weekStart = day.date
        week.views += day.views
        week.watchTime += day.watchTime
        week.likes += day.likes
        week.comments += day.comments
    })

    const weekly = Array.from(weeklyMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, week]) => week)

    const totals = {
        views: videos.reduce((sum, video) => sum + (video.views || 0), 0),
        watchTime: watchTimeRows[0]?.watchTime || 0,
        likes: totalLikes,
        comments: totalComments,
        videos: videos.length
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totals,
                daily: dailyList.slice(-days),
                weekly
            },
            "Channel analytics fetched successfully"
        )
    )
})

export const getChannelVideos = asyncHandler(async (req, res) => {
    //: Get all the videos uploaded by the channel
    // Verify authenticated user exists
    const currentUser = await User.findById(req.user?._id)
    if (!currentUser) {
        throw new ApiError(404, "User not found")
    }

    const channelId = req.user?._id

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const sortBy = req.query.sortBy || "createdAt"
    const sortType = req.query.sortType === "asc" ? 1 : -1
    const skip = (page - 1) * limit

    // Aggregation pipeline to get channel videos with stats
    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                commentsCount: { $size: "$comments" }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                videoFile: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                likesCount: 1,
                commentsCount: 1
            }
        },
        {
            $sort: { [sortBy]: sortType }
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        }
    ])

    // Get total count for pagination
    const totalVideos = await Video.countDocuments({
        owner: channelId
    })

    return res.status(200).json(
        new ApiResponse(200, {
            videos,
            channel: {
                _id: currentUser._id,
                username: currentUser.username,
                fullName: currentUser.fullName,
                avatar: currentUser.avatar
            },
            pagination: {
                page,
                limit,
                total: totalVideos,
                pages: Math.ceil(totalVideos / limit),
                hasNextPage: page < Math.ceil(totalVideos / limit),
                hasPrevPage: page > 1
            }
        }, "Channel videos retrieved successfully")
    )
})
