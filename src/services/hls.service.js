import { cloudinary } from "../utils/cloudinary.js"
import { Video } from "../models/video.models.js"

const HLS_PROFILE = "auto:maxres_720p"
const HLS_STATUS = Object.freeze({
    PENDING: "pending",
    PROCESSING: "processing",
    READY: "ready",
    UNAVAILABLE: "unavailable"
})

const PROBE_TIMEOUT_MS = 8000
const RECHECK_AFTER_MS = {
    [HLS_STATUS.PENDING]: 2 * 60 * 1000,
    [HLS_STATUS.PROCESSING]: 5 * 60 * 1000,
    [HLS_STATUS.READY]: 24 * 60 * 60 * 1000,
    [HLS_STATUS.UNAVAILABLE]: 60 * 60 * 1000
}

const parseCloudinaryVideoUrl = (url) => {
    if (typeof url !== "string" || !url.includes("/video/upload/")) return null

    const parts = url.split("/")
    const uploadIndex = parts.indexOf("upload")
    if (uploadIndex === -1) return null

    let remainder = parts.slice(uploadIndex + 1).join("/")
    remainder = remainder.replace(/^v\d+\//, "")

    const extensionIndex = remainder.lastIndexOf(".")
    const publicId = extensionIndex > 0 ? remainder.slice(0, extensionIndex) : remainder
    if (!publicId) return null

    const versionMatch = url.match(/\/upload\/(?:[^/]+\/)*?v(\d+)\//)
    return {
        publicId,
        version: versionMatch ? Number(versionMatch[1]) : null
    }
}

const buildHlsPlaybackUrl = ({ publicId, version }) => {
    if (!publicId) return null

    return cloudinary.url(publicId, {
        resource_type: "video",
        type: "upload",
        streaming_profile: HLS_PROFILE,
        format: "m3u8",
        secure: true,
        ...(version ? { version } : {})
    })
}

const createHlsMetadata = (uploadResult) => {
    if (!uploadResult?.public_id) return null

    return {
        playbackUrl: buildHlsPlaybackUrl({
            publicId: uploadResult.public_id,
            version: uploadResult.version
        }),
        status: HLS_STATUS.PENDING,
        profile: HLS_PROFILE,
        publicId: uploadResult.public_id,
        version: uploadResult.version || null,
        variants: [],
        checkedAt: null
    }
}

const deriveHlsMetadata = (videoFileUrl) => {
    const parsed = parseCloudinaryVideoUrl(videoFileUrl)
    if (!parsed) return null

    return {
        playbackUrl: buildHlsPlaybackUrl(parsed),
        status: HLS_STATUS.PENDING,
        profile: HLS_PROFILE,
        publicId: parsed.publicId,
        version: parsed.version,
        variants: [],
        checkedAt: null
    }
}

const parseMasterPlaylist = (manifest) => {
    if (typeof manifest !== "string" || !manifest.includes("#EXTM3U")) return []

    const variants = new Map()

    for (const line of manifest.split(/\r?\n/)) {
        if (!line.startsWith("#EXT-X-STREAM-INF")) continue

        const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/)
        if (!resolution) continue

        const bandwidthMatch = line.match(/(?:AVERAGE-)?BANDWIDTH=(\d+)/)
        const width = Number(resolution[1])
        const height = Number(resolution[2])
        if (!width || !height) continue

        const existing = variants.get(height)
        const bandwidth = bandwidthMatch ? Number(bandwidthMatch[1]) : 0
        if (!existing || bandwidth > existing.bandwidth) {
            variants.set(height, { width, height, bandwidth })
        }
    }

    return [...variants.values()].sort((left, right) => left.height - right.height)
}

const probeHlsPlayback = async (playbackUrl) => {
    if (!playbackUrl) {
        return { status: HLS_STATUS.UNAVAILABLE, variants: [] }
    }

    try {
        const response = await fetch(playbackUrl, {
            method: "GET",
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
        })

        if (response.status === 423) {
            return { status: HLS_STATUS.PROCESSING, variants: [] }
        }
        if (!response.ok) {
            return { status: HLS_STATUS.UNAVAILABLE, variants: [] }
        }

        const manifest = await response.text()
        return {
            status: HLS_STATUS.READY,
            variants: parseMasterPlaylist(manifest)
        }
    } catch {
        return { status: HLS_STATUS.PENDING, variants: [] }
    }
}

const needsStatusCheck = (hls) => {
    if (!hls?.playbackUrl) return false
    if (!hls.checkedAt) return true

    const status = hls.status || HLS_STATUS.PENDING
    const ttl = RECHECK_AFTER_MS[status] || RECHECK_AFTER_MS[HLS_STATUS.PENDING]
    return Date.now() - new Date(hls.checkedAt).getTime() >= ttl
}

const refreshHlsStatus = async (videoId, hls) => {
    if (!needsStatusCheck(hls)) return hls

    const probe = await probeHlsPlayback(hls.playbackUrl)
    const variants = probe.variants.length ? probe.variants : (hls.variants || [])

    await Video.updateOne(
        { _id: videoId },
        {
            $set: {
                "hls.status": probe.status,
                "hls.variants": variants,
                "hls.checkedAt": new Date()
            }
        }
    )

    return { ...hls, status: probe.status, variants }
}

const ensureVideoHls = async (video) => {
    if (video?.hls?.playbackUrl) return video.hls
    if (!video?.videoFile) return null

    const hls = deriveHlsMetadata(video.videoFile)
    if (!hls) return null

    try {
        await Video.updateOne(
            { _id: video._id, "hls.playbackUrl": { $exists: false } },
            { $set: { hls } }
        )
    } catch (error) {
        console.error("Failed to persist HLS metadata for existing video:", error.message)
    }

    return hls
}

export {
    HLS_PROFILE,
    HLS_STATUS,
    buildHlsPlaybackUrl,
    createHlsMetadata,
    deriveHlsMetadata,
    ensureVideoHls,
    parseCloudinaryVideoUrl,
    parseMasterPlaylist,
    probeHlsPlayback,
    refreshHlsStatus
}
