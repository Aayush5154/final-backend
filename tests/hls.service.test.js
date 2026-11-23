import test from "node:test"
import assert from "node:assert/strict"
import {
    HLS_STATUS,
    createHlsMetadata,
    deriveHlsMetadata,
    parseCloudinaryVideoUrl,
    parseMasterPlaylist,
    probeHlsPlayback
} from "../src/services/hls.service.js"

test("extracts public id and version from a Cloudinary video URL", () => {
    assert.deepEqual(
        parseCloudinaryVideoUrl(
            "https://res.cloudinary.com/demo/video/upload/v1777724349/samples/refev9eeg39jvshzv6xp.mp4"
        ),
        { publicId: "samples/refev9eeg39jvshzv6xp", version: 1777724349 }
    )
})

test("ignores non-video URLs", () => {
    assert.equal(parseCloudinaryVideoUrl("https://example.com/image.jpg"), null)
    assert.equal(parseCloudinaryVideoUrl(null), null)
})

test("builds a deterministic capped HLS playback URL", () => {
    const hls = deriveHlsMetadata(
        "https://res.cloudinary.com/demo/video/upload/v1234567890/sample.mp4"
    )

    assert.equal(hls.status, HLS_STATUS.PENDING)
    assert.equal(hls.publicId, "sample")
    assert.equal(hls.version, 1234567890)
    assert.match(hls.playbackUrl, /\/video\/upload\/sp_auto:maxres_720p\/v1234567890\/sample\.m3u8/)
})

test("builds pending HLS metadata from an upload result", () => {
    const hls = createHlsMetadata({
        public_id: "folder/uploaded-video",
        version: 1777724349
    })

    assert.equal(hls.status, HLS_STATUS.PENDING)
    assert.equal(hls.profile, "auto:maxres_720p")
    assert.equal(hls.publicId, "folder/uploaded-video")
    assert.equal(hls.version, 1777724349)
    assert.deepEqual(hls.variants, [])
    assert.match(hls.playbackUrl, /\/sp_auto:maxres_720p\/v1777724349\/folder\/uploaded-video\.m3u8/)
})

test("parses and deduplicates master playlist variants", () => {
    const manifest = [
        "#EXTM3U",
        '#EXT-X-STREAM-INF:BANDWIDTH=280000,RESOLUTION=320x180',
        "180p.m3u8",
        '#EXT-X-STREAM-INF:BANDWIDTH=410000,RESOLUTION=480x270',
        "270p.m3u8",
        '#EXT-X-STREAM-INF:BANDWIDTH=640000,RESOLUTION=640x360',
        "360p.m3u8",
        '#EXT-X-STREAM-INF:BANDWIDTH=900000,AVERAGE-BANDWIDTH=700000,RESOLUTION=640x360',
        "360p-hi.m3u8"
    ].join("\n")

    assert.deepEqual(parseMasterPlaylist(manifest), [
        { width: 320, height: 180, bandwidth: 280000 },
        { width: 480, height: 270, bandwidth: 410000 },
        { width: 640, height: 360, bandwidth: 900000 }
    ])
})

test("reports processing for a 423 response", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response("", { status: 423 })

    try {
        const result = await probeHlsPlayback("https://res.cloudinary.com/demo/video/upload/test.m3u8")
        assert.equal(result.status, HLS_STATUS.PROCESSING)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test("reports ready with variants for a valid manifest", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=1280x720\n720p.m3u8',
        { status: 200 }
    )

    try {
        const result = await probeHlsPlayback("https://res.cloudinary.com/demo/video/upload/test.m3u8")
        assert.equal(result.status, HLS_STATUS.READY)
        assert.deepEqual(result.variants, [{ width: 1280, height: 720, bandwidth: 600000 }])
    } finally {
        globalThis.fetch = originalFetch
    }
})

test("reports unavailable for a missing manifest", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response("", { status: 404 })

    try {
        const result = await probeHlsPlayback("https://res.cloudinary.com/demo/video/upload/test.m3u8")
        assert.equal(result.status, HLS_STATUS.UNAVAILABLE)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test("keeps pending on a network error", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
        throw new Error("network down")
    }

    try {
        const result = await probeHlsPlayback("https://res.cloudinary.com/demo/video/upload/test.m3u8")
        assert.equal(result.status, HLS_STATUS.PENDING)
    } finally {
        globalThis.fetch = originalFetch
    }
})
