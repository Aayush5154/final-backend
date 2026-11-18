import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const TRANSCRIBE_SCRIPT = fileURLToPath(new URL("../../scripts/transcribe.py", import.meta.url))
const WORK_DIR = path.join(tmpdir(), "videotube-insights")
const PYTHON_BINARY = process.env.WHISPER_PYTHON || "python"
const WHISPER_MODEL = process.env.WHISPER_MODEL || "base"
const PROCESS_TIMEOUT_MS = Number(process.env.WHISPER_TIMEOUT_MS) || 15 * 60 * 1000

const runProcess = (command, args, timeoutMs) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ""
    let stderr = ""
    let settled = false

    const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill()
        reject(new Error(`${path.basename(command)} timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => {
        // Keep only the tail; model download logs can be large
        stderr = (stderr + chunk.toString()).slice(-4000)
    })

    child.on("error", (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
    })

    child.on("close", (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (code === 0) {
            resolve({ stdout, stderr })
        } else {
            reject(new Error(`${path.basename(command)} exited with code ${code}: ${stderr.trim().slice(-500)}`))
        }
    })
})

const downloadToFile = async (url, destination) => {
    const response = await fetch(url)
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download video (${response.status})`)
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

// Downloads the uploaded video, extracts 16kHz mono audio with ffmpeg and
// transcribes it locally with faster-whisper. No external transcription API.
const transcribeVideo = async (videoUrl) => {
    await mkdir(WORK_DIR, { recursive: true })
    const jobId = randomUUID()
    const videoPath = path.join(WORK_DIR, `${jobId}.video`)
    const audioPath = path.join(WORK_DIR, `${jobId}.wav`)

    try {
        await downloadToFile(videoUrl, videoPath)
        await runProcess("ffmpeg", [
            "-y", "-loglevel", "error",
            "-i", videoPath,
            "-vn", "-ac", "1", "-ar", "16000",
            "-f", "wav", audioPath
        ], PROCESS_TIMEOUT_MS)

        const { stdout } = await runProcess(
            PYTHON_BINARY,
            [TRANSCRIBE_SCRIPT, audioPath, WHISPER_MODEL],
            PROCESS_TIMEOUT_MS
        )

        const result = JSON.parse(stdout)
        return {
            language: result.language || "",
            model: WHISPER_MODEL,
            fullText: result.text || "",
            segments: Array.isArray(result.segments) ? result.segments : []
        }
    } finally {
        await Promise.all([
            rm(videoPath, { force: true }),
            rm(audioPath, { force: true })
        ])
    }
}

export { transcribeVideo }
