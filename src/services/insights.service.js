import { Video } from "../models/video.models.js"
import { VideoInsight } from "../models/videoinsight.models.js"
import { transcribeVideo } from "./transcription.service.js"
import { generateVideoAnalysis } from "./gemini.service.js"
import { emitToUser, emitToVideo } from "../socket/index.js"

// Single-process FIFO queue; MongoDB statuses stay the source of truth and
// activeJobs prevents the same video being queued twice.
const queue = []
const activeJobs = new Set()
let draining = false

const broadcast = (insight) => {
    const payload = { insight }
    emitToVideo(insight.video, "insights:updated", payload)
    emitToUser(insight.owner, "insights:updated", payload)
}

const failStage = async (videoId, stage, error) => {
    const insight = await VideoInsight.findOneAndUpdate(
        { video: videoId },
        { $set: { [`${stage}.status`]: "failed", [`${stage}.error`]: error.message || "Processing failed" } },
        { new: true }
    ).lean()
    if (insight) broadcast(insight)
}

const processVideo = async (videoId) => {
    const video = await Video.findById(videoId).select("title description videoFile owner")
    if (!video) {
        await failStage(videoId, "transcription", new Error("Video no longer exists"))
        return
    }

    let insight = await VideoInsight.findOne({ video: videoId }).lean()
    if (!insight) return

    const hasTranscript = insight.transcription.status === "ready" && Boolean(insight.transcription.fullText)

    if (!hasTranscript) {
        insight = await VideoInsight.findOneAndUpdate(
            { video: videoId, "transcription.status": { $ne: "processing" } },
            { $set: { "transcription.status": "processing", "transcription.error": "" } },
            { new: true }
        ).lean()
        if (!insight) return
        broadcast(insight)

        try {
            const transcript = await transcribeVideo(video.videoFile)
            if (!transcript.fullText) {
                throw new Error("No speech detected in this video")
            }

            insight = await VideoInsight.findOneAndUpdate(
                { video: videoId },
                {
                    $set: {
                        "transcription.status": "ready",
                        "transcription.error": "",
                        "transcription.language": transcript.language,
                        "transcription.model": transcript.model,
                        "transcription.fullText": transcript.fullText,
                        "transcription.segments": transcript.segments
                    }
                },
                { new: true }
            ).lean()
            broadcast(insight)
        } catch (error) {
            console.error(`Transcription failed for video ${videoId}:`, error.message)
            await failStage(videoId, "transcription", error)
            return
        }
    }

    insight = await VideoInsight.findOneAndUpdate(
        { video: videoId, "analysis.status": { $ne: "processing" } },
        { $set: { "analysis.status": "processing", "analysis.error": "" } },
        { new: true }
    ).lean()
    if (!insight) return
    broadcast(insight)

    try {
        const analysis = await generateVideoAnalysis({
            title: video.title,
            description: video.description,
            transcript: insight.transcription.fullText
        })

        const updated = await VideoInsight.findOneAndUpdate(
            { video: videoId },
            {
                $set: {
                    "analysis.status": "ready",
                    "analysis.error": "",
                    "analysis.shortSummary": analysis.shortSummary,
                    "analysis.detailedSummary": analysis.detailedSummary,
                    "analysis.takeaways": analysis.takeaways
                }
            },
            { new: true }
        ).lean()
        broadcast(updated)
    } catch (error) {
        console.error(`Analysis failed for video ${videoId}:`, error.message)
        await failStage(videoId, "analysis", error)
    }
}

const drainQueue = async () => {
    if (draining) return
    draining = true

    try {
        while (queue.length) {
            const videoId = queue.shift()
            try {
                await processVideo(videoId)
            } catch (error) {
                console.error(`Insights job failed for video ${videoId}:`, error.message)
                await failStage(videoId, "transcription", error).catch(() => {})
            } finally {
                activeJobs.delete(videoId)
            }
        }
    } finally {
        draining = false
    }
}

const requestInsights = async (video, { force = false } = {}) => {
    let insight = await VideoInsight.findOneAndUpdate(
        { video: video._id },
        { $setOnInsert: { video: video._id, owner: video.owner } },
        { new: true, upsert: true }
    )

    const isProcessing = ["transcription", "analysis"].some((stage) => insight[stage].status === "processing")
    const isComplete = insight.transcription.status === "ready" && insight.analysis.status === "ready"

    if (force && !isProcessing) {
        insight = await VideoInsight.findOneAndUpdate(
            { video: video._id },
            {
                $set: {
                    "transcription.status": "pending",
                    "transcription.error": "",
                    "analysis.status": "pending",
                    "analysis.error": ""
                }
            },
            { new: true }
        )
    }

    if (activeJobs.has(video._id.toString()) || isProcessing || (isComplete && !force)) {
        return { insight, started: false }
    }

    activeJobs.add(video._id.toString())
    queue.push(video._id.toString())
    drainQueue()

    return { insight, started: true }
}

// Jobs interrupted by a restart are marked failed so they can be retried
// instead of staying stuck in "processing" forever.
const markInterruptedInsights = async () => {
    await Promise.all(["transcription", "analysis"].map((stage) =>
        VideoInsight.updateMany(
            { [`${stage}.status`]: "processing" },
            { $set: { [`${stage}.status`]: "failed", [`${stage}.error`]: "Processing interrupted by a server restart. Please retry." } }
        )
    ))
}

export { requestInsights, markInterruptedInsights }
