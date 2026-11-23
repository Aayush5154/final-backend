import { createHash } from "crypto"
import { VideoInsight } from "../models/videoinsight.models.js"
import { emitToUser, emitToVideo } from "../socket/index.js"

const QDRANT_URL = (process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "")
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "videotube_transcripts"
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768)
const REQUEST_TIMEOUT_MS = 45000
const MAX_CHUNK_CHARS = 1200
const MAX_SEGMENTS_PER_CHUNK = 6
const activeIndexes = new Set()

const broadcast = (insight) => {
    const payload = { insight }
    emitToVideo(insight.video, "insights:updated", payload)
    emitToUser(insight.owner, "insights:updated", payload)
}

const chunkTranscript = (segments) => {
    const chunks = []
    let current = []

    const flush = () => {
        if (!current.length) return
        chunks.push({
            chunkIndex: chunks.length,
            start: current[0].start,
            end: current[current.length - 1].end,
            text: current.map((segment) => segment.text).join(" ").trim()
        })
        current = []
    }

    for (const segment of segments) {
        const text = segment.text?.trim()
        if (!text) continue

        const nextLength = current.reduce((total, item) => total + item.text.length + 1, 0) + text.length
        if (current.length && (current.length >= MAX_SEGMENTS_PER_CHUNK || nextLength > MAX_CHUNK_CHARS)) {
            flush()
        }
        current.push({ ...segment, text })
    }
    flush()

    return chunks
}

const pointId = (videoId, chunkIndex) => {
    const hash = createHash("sha256").update(`${videoId}:${chunkIndex}`).digest("hex")
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

const embedTexts = async (texts, taskType) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server")
    }

    const embeddings = []
    for (let offset = 0; offset < texts.length; offset += 50) {
        const batch = texts.slice(offset, offset + 50)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    requests: batch.map((text) => ({
                        model: `models/${EMBEDDING_MODEL}`,
                        content: { parts: [{ text }] },
                        taskType,
                        outputDimensionality: EMBEDDING_DIMENSIONS
                    }))
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            }
        )

        if (!response.ok) {
            const body = await response.text()
            throw new Error(`Gemini embedding request failed (${response.status}): ${body.slice(0, 200)}`)
        }

        const payload = await response.json()
        if (payload.embeddings?.length !== batch.length) {
            throw new Error("Gemini returned an incomplete embedding batch")
        }
        embeddings.push(...payload.embeddings.map((item) => item.values))
    }

    return embeddings
}

const qdrantRequest = async (path, options = {}) => {
    const headers = { "Content-Type": "application/json", ...options.headers }
    if (process.env.QDRANT_API_KEY) headers["api-key"] = process.env.QDRANT_API_KEY

    let response
    try {
        response = await fetch(`${QDRANT_URL}${path}`, {
            ...options,
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })
    } catch (error) {
        throw new Error(`Qdrant is unavailable at ${QDRANT_URL}: ${error.message}`)
    }

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Qdrant request failed (${response.status}): ${body.slice(0, 200)}`)
    }

    return response.status === 204 ? null : response.json()
}

const ensureCollection = async () => {
    await qdrantRequest(`/collections/${QDRANT_COLLECTION}`, {
        method: "PUT",
        body: JSON.stringify({
            vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" }
        })
    })
}

const indexVideoTranscript = async (videoId, { force = false } = {}) => {
    const key = videoId.toString()
    if (activeIndexes.has(key)) return { started: false, status: "processing" }

    const insight = await VideoInsight.findOne({ video: videoId }).lean()
    if (!insight || insight.transcription.status !== "ready" || !insight.transcription.segments?.length) {
        throw new Error("A completed transcript is required before chat is available")
    }
    if (insight.embedding?.status === "ready" && !force) {
        return { started: false, status: "ready", chunkCount: insight.embedding.chunkCount }
    }
    if (insight.embedding?.status === "processing") {
        return { started: false, status: "processing" }
    }

    const claimed = await VideoInsight.findOneAndUpdate(
        { _id: insight._id, "embedding.status": { $ne: "processing" } },
        { $set: { "embedding.status": "processing", "embedding.error": "" } },
        { new: true }
    ).lean()
    if (!claimed) return { started: false, status: "processing" }

    activeIndexes.add(key)
    broadcast(claimed)

    try {
        const chunks = chunkTranscript(insight.transcription.segments)
        if (!chunks.length) throw new Error("The transcript has no usable text")

        const vectors = await embedTexts(
            chunks.map((chunk) => `${chunk.text}\nTimestamp: ${chunk.start}-${chunk.end} seconds`),
            "RETRIEVAL_DOCUMENT"
        )
        await ensureCollection()
        await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points/delete?wait=true`, {
            method: "POST",
            body: JSON.stringify({
                filter: { must: [{ key: "videoId", match: { value: key } }] }
            })
        })
        await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points?wait=true`, {
            method: "PUT",
            body: JSON.stringify({
                points: chunks.map((chunk, index) => ({
                    id: pointId(key, chunk.chunkIndex),
                    vector: vectors[index],
                    payload: { videoId: key, ...chunk }
                }))
            })
        })

        const updated = await VideoInsight.findByIdAndUpdate(
            insight._id,
            {
                $set: {
                    "embedding.status": "ready",
                    "embedding.error": "",
                    "embedding.model": EMBEDDING_MODEL,
                    "embedding.chunkCount": chunks.length
                }
            },
            { new: true }
        ).lean()
        broadcast(updated)
        return { started: true, status: "ready", chunkCount: chunks.length }
    } catch (error) {
        const failed = await VideoInsight.findByIdAndUpdate(
            insight._id,
            { $set: { "embedding.status": "failed", "embedding.error": error.message } },
            { new: true }
        ).lean()
        if (failed) broadcast(failed)
        throw error
    } finally {
        activeIndexes.delete(key)
    }
}

const getVideoChunkVectors = async (videoIds) => {
    if (!videoIds.length) return []

    const points = []
    let offset = null

    while (points.length < 1000) {
        const body = {
            filter: {
                must: [{ key: "videoId", match: { any: videoIds.map(String) } }]
            },
            with_payload: true,
            with_vector: true,
            limit: Math.min(256, 1000 - points.length)
        }
        if (offset) body.offset = offset

        let response
        try {
            response = await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points/scroll`, {
                method: "POST",
                body: JSON.stringify(body)
            })
        } catch (error) {
            if (error.message.includes("(404)")) return []
            throw error
        }

        const batch = response.result?.points || []
        points.push(...batch)
        offset = response.result?.next_page_offset
        if (!offset || !batch.length) break
    }

    return points
}

const searchVideoChunks = async (vector, limit = 120) => {
    let response
    try {
        response = await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points/search`, {
            method: "POST",
            body: JSON.stringify({
                vector,
                limit,
                with_payload: true
            })
        })
    } catch (error) {
        if (error.message.includes("(404)")) return []
        throw error
    }

    return (response.result || []).map((item) => ({
        score: item.score,
        videoId: item.payload?.videoId,
        chunkIndex: item.payload?.chunkIndex,
        start: item.payload?.start,
        end: item.payload?.end,
        text: item.payload?.text
    }))
}

const retrieveTranscriptChunks = async (videoId, question, limit = 5) => {
    const [vector] = await embedTexts([question], "RETRIEVAL_QUERY")
    const result = await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points/search`, {
        method: "POST",
        body: JSON.stringify({
            vector,
            limit,
            with_payload: true,
            filter: { must: [{ key: "videoId", match: { value: videoId.toString() } }] }
        })
    })

    return (result.result || []).map((item) => ({
        score: item.score,
        videoId: item.payload.videoId,
        chunkIndex: item.payload.chunkIndex,
        start: item.payload.start,
        end: item.payload.end,
        text: item.payload.text
    }))
}

export {
    chunkTranscript,
    getVideoChunkVectors,
    indexVideoTranscript,
    retrieveTranscriptChunks,
    searchVideoChunks
}
