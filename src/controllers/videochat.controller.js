import { isValidObjectId } from "mongoose"
import { Video } from "../models/video.models.js"
import { VideoChat } from "../models/videochat.models.js"
import { indexVideoTranscript, retrieveTranscriptChunks } from "../services/rag.service.js"
import { generateVideoChatAnswer } from "../services/gemini.service.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const activeChats = new Set()

const getVideoChat = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID")

    const video = await Video.exists({ _id: videoId })
    if (!video) throw new ApiError(404, "Video not found")

    const chat = await VideoChat.findOne({ video: videoId, user: req.user._id }).lean()
    return res.status(200).json(new ApiResponse(
        200,
        { messages: chat?.messages || [] },
        "Video chat history fetched successfully"
    ))
})

const askVideoQuestion = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID")

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : ""
    if (!question) throw new ApiError(400, "Question is required")
    if (question.length > 1000) throw new ApiError(400, "Question must be 1000 characters or less")

    const video = await Video.findById(videoId).select("title").lean()
    if (!video) throw new ApiError(404, "Video not found")

    const chatKey = `${req.user._id}:${videoId}`
    if (activeChats.has(chatKey)) throw new ApiError(409, "A question is already being processed for this video")
    activeChats.add(chatKey)

    try {
        const index = await indexVideoTranscript(videoId)
        if (index.status === "processing") {
            throw new ApiError(409, "This video's transcript is being indexed. Please try again shortly.")
        }

        const chat = await VideoChat.findOne({ video: videoId, user: req.user._id }).lean()
        const history = chat?.messages || []
        const previousQuestion = [...history].reverse().find((message) => message.role === "user")?.content
        const retrievalQuestion = previousQuestion ? `${previousQuestion}\nFollow-up: ${question}` : question
        const chunks = await retrieveTranscriptChunks(videoId, retrievalQuestion)
        const answer = chunks.length
            ? await generateVideoChatAnswer({ title: video.title, question, chunks, history })
            : "I couldn't find that information in this video's transcript."
        const now = new Date()
        const newMessages = [
            { role: "user", content: question, createdAt: now },
            { role: "assistant", content: answer, createdAt: new Date() }
        ]

        const updated = await VideoChat.findOneAndUpdate(
            { video: videoId, user: req.user._id },
            { $push: { messages: { $each: newMessages, $slice: -100 } } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean()

        return res.status(201).json(new ApiResponse(
            201,
            { answer, messages: updated.messages },
            "Question answered from the video transcript"
        ))
    } finally {
        activeChats.delete(chatKey)
    }
})

export { getVideoChat, askVideoQuestion }
