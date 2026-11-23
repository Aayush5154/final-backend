import { isValidObjectId, Types } from "mongoose"
import { Video } from "../models/video.models.js"
import { Like } from "../models/like.models.js"
import { Comment } from "../models/comment.models.js"
import { Subscription } from "../models/subscription.models.js"
import { WatchHistory } from "../models/watchhistory.models.js"
import { WatchProgress } from "../models/watchprogress.models.js"
import { getVideoChunkVectors, searchVideoChunks } from "./rag.service.js"

const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000
const EMPTY_PROFILE_CACHE_TTL_MS = 60 * 1000
const MAX_PROFILE_CACHE_ENTRIES = 500
const MAX_SIGNAL_VIDEOS = 30
const MAX_SEMANTIC_CANDIDATES = 120
const MAX_RECENT_SUPPLEMENTS = 60
const MAX_FALLBACK_CANDIDATES = 200
const DAY_MS = 24 * 60 * 60 * 1000

const PERSONALIZED_WEIGHTS = {
    semantic: 0.55,
    engagement: 0.2,
    freshness: 0.15,
    subscription: 0.1
}

const FALLBACK_WEIGHTS = {
    engagement: 0.45,
    freshness: 0.4,
    subscription: 0.15
}

const profileCache = new Map()
const profileBuilds = new Map()

const daysSince = (date, now = Date.now()) => {
    if (!date) return Number.POSITIVE_INFINITY
    return Math.max(0, (now - new Date(date).getTime()) / DAY_MS)
}

const recencyFactor = (date, now, halfLifeDays = 30) => {
    const age = daysSince(date, now)
    if (!Number.isFinite(age)) return 0
    return Math.exp(-age / halfLifeDays)
}

const collectUserSignals = async (userId, now = Date.now()) => {
    const [history, likes, comments, subscriptions] = await Promise.all([
        WatchHistory.find({ owner: userId })
            .sort({ watchedAt: -1 })
            .limit(MAX_SIGNAL_VIDEOS)
            .select("video watchedAt")
            .lean(),
        Like.find({ likedBy: userId, video: { $ne: null } })
            .sort({ createdAt: -1 })
            .limit(MAX_SIGNAL_VIDEOS)
            .select("video createdAt")
            .lean(),
        Comment.find({ owner: userId, video: { $ne: null } })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("video createdAt")
            .lean(),
        Subscription.find({ subscriber: userId })
            .select("channel")
            .lean()
    ])

    const historyIds = history.map((entry) => entry.video).filter(Boolean)
    const progress = historyIds.length
        ? await WatchProgress.find({
            owner: userId,
            video: { $in: historyIds }
        })
            .select("video completed")
            .lean()
        : []

    const completedVideos = new Set(
        progress.filter((entry) => entry.completed).map((entry) => String(entry.video))
    )

    const weights = new Map()
    const addWeight = (videoId, weight) => {
        if (!videoId) return
        const key = String(videoId)
        weights.set(key, Math.min(5, (weights.get(key) || 0) + weight))
    }

    history.forEach((entry) => {
        const completionBoost = completedVideos.has(String(entry.video)) ? 0.75 : 0
        addWeight(entry.video, 1 + recencyFactor(entry.watchedAt, now) + completionBoost)
    })

    likes.forEach((entry) => {
        addWeight(entry.video, 2 + recencyFactor(entry.createdAt, now) * 0.5)
    })

    comments.forEach((entry) => {
        addWeight(entry.video, 1.5 + recencyFactor(entry.createdAt, now) * 0.5)
    })

    const sourceVideoIds = [...weights.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, MAX_SIGNAL_VIDEOS)
        .map(([videoId]) => videoId)

    return {
        weights,
        sourceVideoIds,
        subscribedChannelIds: new Set(subscriptions.map((entry) => String(entry.channel)))
    }
}

const buildInterestProfile = async (userId) => {
    const signals = await collectUserSignals(userId)
    const baseProfile = {
        profileVector: null,
        sourceVideoIds: signals.sourceVideoIds,
        subscribedChannelIds: signals.subscribedChannelIds,
        signalCount: signals.sourceVideoIds.length
    }

    if (!signals.sourceVideoIds.length) return baseProfile

    let points
    try {
        points = await getVideoChunkVectors(signals.sourceVideoIds)
    } catch (error) {
        console.error("Failed to read transcript vectors for recommendation profile:", error.message)
        return baseProfile
    }

    if (!points.length) return baseProfile

    const videoSums = new Map()
    for (const point of points) {
        const vector = Array.isArray(point.vector) ? point.vector : point.vector?.default
        const videoId = point.payload?.videoId
        if (!videoId || !Array.isArray(vector) || !vector.length) continue

        let entry = videoSums.get(String(videoId))
        if (!entry) {
            entry = { sum: new Array(vector.length).fill(0), count: 0 }
            videoSums.set(String(videoId), entry)
        }
        if (vector.length !== entry.sum.length) continue

        vector.forEach((value, index) => {
            entry.sum[index] += value
        })
        entry.count += 1
    }

    let dimensions = 0
    let profileVector = null

    for (const [videoId, entry] of videoSums) {
        if (!entry.count) continue
        const weight = signals.weights.get(videoId) || 0
        if (!weight) continue

        const centroid = entry.sum.map((value) => value / entry.count)
        const centroidNorm = Math.sqrt(centroid.reduce((total, value) => total + value * value, 0))
        if (!centroidNorm) continue

        if (!profileVector) {
            dimensions = centroid.length
            profileVector = new Array(dimensions).fill(0)
        }
        if (centroid.length !== dimensions) continue

        centroid.forEach((value, index) => {
            profileVector[index] += (value / centroidNorm) * weight
        })
    }

    if (!profileVector) return baseProfile

    const profileNorm = Math.sqrt(
        profileVector.reduce((total, value) => total + value * value, 0)
    )
    if (!profileNorm) return baseProfile

    return {
        ...baseProfile,
        profileVector: profileVector.map((value) => value / profileNorm)
    }
}

const getInterestProfile = async (userId) => {
    const key = String(userId)
    const now = Date.now()
    const cached = profileCache.get(key)

    if (cached && cached.expiresAt > now) return cached.profile
    if (profileBuilds.has(key)) return profileBuilds.get(key)

    const build = buildInterestProfile(userId)
        .then((profile) => {
            if (profileCache.size >= MAX_PROFILE_CACHE_ENTRIES) {
                const oldestKey = profileCache.keys().next().value
                if (oldestKey) profileCache.delete(oldestKey)
            }
            profileCache.set(key, {
                profile,
                expiresAt: now + (profile.profileVector
                    ? PROFILE_CACHE_TTL_MS
                    : EMPTY_PROFILE_CACHE_TTL_MS)
            })
            return profile
        })
        .finally(() => {
            profileBuilds.delete(key)
        })

    profileBuilds.set(key, build)
    return build
}

const collectEngagementCounts = async (videoIds) => {
    if (!videoIds.length) {
        return { likes: new Map(), comments: new Map() }
    }

    const [likeRows, commentRows] = await Promise.all([
        Like.aggregate([
            { $match: { video: { $in: videoIds } } },
            { $group: { _id: "$video", count: { $sum: 1 } } }
        ]),
        Comment.aggregate([
            { $match: { video: { $in: videoIds } } },
            { $group: { _id: "$video", count: { $sum: 1 } } }
        ])
    ])

    return {
        likes: new Map(likeRows.map((row) => [String(row._id), row.count])),
        comments: new Map(commentRows.map((row) => [String(row._id), row.count]))
    }
}

const normalizedLog = (value, maximum) => {
    if (!maximum || maximum < 1) return 0
    return Math.log10(1 + Math.max(0, value)) / Math.log10(1 + maximum)
}

const rankVideos = async (videos, semanticScores, subscribedChannelIds, personalized) => {
    if (!videos.length) return []

    const engagement = await collectEngagementCounts(videos.map((video) => video._id))
    const maxViews = Math.max(...videos.map((video) => video.views || 0), 0)
    const maxLikes = Math.max(...engagement.likes.values(), 0)
    const maxComments = Math.max(...engagement.comments.values(), 0)
    const now = Date.now()

    const ranked = videos.map((video) => {
        const id = String(video._id)
        const views = video.views || 0
        const likeCount = engagement.likes.get(id) || 0
        const commentCount = engagement.comments.get(id) || 0

        const engagementScore =
            normalizedLog(likeCount, maxLikes) * 0.45 +
            normalizedLog(views, maxViews) * 0.35 +
            normalizedLog(commentCount, maxComments) * 0.2
        const freshnessScore = recencyFactor(video.createdAt, now)
        const ownerId = String(video.owner?._id || video.owner || "")
        const subscriptionScore = subscribedChannelIds.has(ownerId) ? 1 : 0
        const similarity = semanticScores.get(id)

        let score
        if (personalized) {
            score =
                (similarity ?? 0) * PERSONALIZED_WEIGHTS.semantic +
                engagementScore * PERSONALIZED_WEIGHTS.engagement +
                freshnessScore * PERSONALIZED_WEIGHTS.freshness +
                subscriptionScore * PERSONALIZED_WEIGHTS.subscription
        } else {
            score =
                engagementScore * FALLBACK_WEIGHTS.engagement +
                freshnessScore * FALLBACK_WEIGHTS.freshness +
                subscriptionScore * FALLBACK_WEIGHTS.subscription
        }

        return {
            video,
            score,
            similarity: similarity ?? null,
            engagementScore,
            freshnessScore,
            subscriptionScore
        }
    })

    return ranked.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return new Date(right.video.createdAt).getTime() - new Date(left.video.createdAt).getTime()
    })
}

const getRecommendations = async ({ userId, page = 1, limit = 12 }) => {
    const profile = await getInterestProfile(userId)
    const semanticScores = new Map()

    if (profile.profileVector) {
        try {
            const matches = await searchVideoChunks(
                profile.profileVector,
                MAX_SEMANTIC_CANDIDATES
            )
            matches.forEach((match) => {
                if (!match.videoId || !isValidObjectId(match.videoId)) return
                const score = Math.max(0, Math.min(1, match.score ?? 0))
                const current = semanticScores.get(match.videoId) || 0
                if (score > current) semanticScores.set(match.videoId, score)
            })
        } catch (error) {
            console.error("Recommendation similarity search failed:", error.message)
        }
    }

    const candidateMap = new Map()
    const semanticIds = [...semanticScores.keys()]

    if (semanticIds.length) {
        const semanticVideos = await Video.find({
            _id: { $in: semanticIds },
            isPublished: true
        })
            .populate("owner", "username avatar fullname")
            .lean()

        semanticVideos.forEach((video) => {
            if (video.owner) candidateMap.set(String(video._id), video)
        })
    }

    const personalized = Boolean(profile.profileVector && semanticScores.size)
    const supplementFilter = { isPublished: true }
    if (candidateMap.size) {
        supplementFilter._id = {
            $nin: [...candidateMap.keys()].map((id) => new Types.ObjectId(id))
        }
    }

    const supplements = await Video.find(supplementFilter)
        .sort(personalized ? { createdAt: -1 } : { views: -1, createdAt: -1 })
        .limit(personalized ? MAX_RECENT_SUPPLEMENTS : MAX_FALLBACK_CANDIDATES)
        .populate("owner", "username avatar fullname")
        .lean()

    supplements.forEach((video) => {
        if (!video.owner) return
        const id = String(video._id)
        if (!candidateMap.has(id)) candidateMap.set(id, video)
    })

    const ranked = await rankVideos(
        [...candidateMap.values()],
        semanticScores,
        profile.subscribedChannelIds,
        personalized
    )

    const start = (page - 1) * limit
    const selected = ranked.slice(start, start + limit)
    const videos = selected.map((entry) => ({
        ...entry.video,
        recommendation: {
            score: Number(entry.score.toFixed(4)),
            similarity: entry.similarity === null
                ? null
                : Number(entry.similarity.toFixed(4)),
            engagement: Number(entry.engagementScore.toFixed(4)),
            freshness: Number(entry.freshnessScore.toFixed(4)),
            fromSubscription: entry.subscriptionScore === 1
        }
    }))

    return {
        videos,
        page,
        limit,
        total: ranked.length,
        hasMore: start + videos.length < ranked.length,
        personalized,
        mode: personalized ? "personalized" : "trending"
    }
}

export {
    getInterestProfile,
    getRecommendations
}
