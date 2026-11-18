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

export { generateVideoAnalysis }
