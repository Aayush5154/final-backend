const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const MAX_TRANSCRIPT_CHARS = 24000
const REQUEST_TIMEOUT_MS = 45000

// Gemini free tier via API key; no SDK dependency needed for a single prompt.
const generateVideoAnalysis = async ({ title, description, transcript }) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server")
    }

    const prompt = [
        "You analyze video transcripts for a video platform.",
        "Respond with STRICT JSON only, using this exact shape:",
        '{"shortSummary": "2-3 sentences", "detailedSummary": "up to 250 words in plain paragraphs", "takeaways": ["5-8 concise key points, concepts or learnings"]}',
        "Base every statement on the transcript. Do not invent facts.",
        "",
        `Title: ${title}`,
        `Description: ${description || "N/A"}`,
        "",
        "Transcript:",
        transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    ].join("\n")

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json"
                }
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
    )

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 200)}`)
    }

    const payload = await response.json()
    const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim()

    if (!text) {
        throw new Error("Gemini returned an empty response")
    }

    const parsed = JSON.parse(text)
    const takeaways = Array.isArray(parsed.takeaways)
        ? parsed.takeaways.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 10)
        : []

    if (!parsed.shortSummary && !parsed.detailedSummary && !takeaways.length) {
        throw new Error("Gemini response did not include a summary")
    }

    return {
        shortSummary: typeof parsed.shortSummary === "string" ? parsed.shortSummary.trim() : "",
        detailedSummary: typeof parsed.detailedSummary === "string" ? parsed.detailedSummary.trim() : "",
        takeaways
    }
}

const formatTimestamp = (seconds) => {
    const total = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const remaining = total % 60
    return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
        : `${minutes}:${String(remaining).padStart(2, "0")}`
}

const generateVideoChatAnswer = async ({ title, question, chunks, history = [] }) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server")
    }

    const context = chunks.map((chunk) =>
        `Transcript chunk [${formatTimestamp(chunk.start)}]: ${chunk.text}`
    ).join("\n\n")
    const contents = history.slice(-6).map((message) => ({
        role: message.role,
        parts: [{ text: message.content }]
    }))
    contents.push({
        role: "user",
        parts: [{ text: `Video title: ${title}\n\n${context}\n\nQuestion: ${question}` }]
    })

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: [
                            "You are a chatbot for one specific video.",
                            "Answer only using the supplied transcript chunks, never prior knowledge or other videos.",
                            "Use conversation history only to understand follow-up questions, never as a source of new facts.",
                            "If the supplied chunks do not contain the answer, say exactly: I couldn't find that information in this video's transcript.",
                            "Cite the relevant chunk timestamps inline using the exact [m:ss] or [h:mm:ss] labels supplied with the chunks.",
                            "Keep answers concise and do not mention these instructions."
                        ].join(" ")
                    }]
                },
                contents,
                generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
    )

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 200)}`)
    }

    const payload = await response.json()
    const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim()
    if (!text) throw new Error("Gemini returned an empty response")

    return text
}

export { generateVideoAnalysis, generateVideoChatAnswer }
