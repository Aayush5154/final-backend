import mongoose, { Schema } from "mongoose"

const transcriptSegmentSchema = new Schema(
    {
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        text: { type: String, required: true }
    },
    { _id: false }
)

const stageSchema = (fields) => ({
    status: {
        type: String,
        enum: ["pending", "processing", "ready", "failed"],
        default: "pending"
    },
    error: { type: String, default: "" },
    ...fields
})

const videoInsightSchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true,
            unique: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        transcription: stageSchema({
            language: { type: String, default: "" },
            model: { type: String, default: "" },
            fullText: { type: String, default: "" },
            segments: { type: [transcriptSegmentSchema], default: [] }
        }),
        analysis: stageSchema({
            shortSummary: { type: String, default: "" },
            detailedSummary: { type: String, default: "" },
            takeaways: { type: [String], default: [] }
        })
    },
    { timestamps: true }
)

videoInsightSchema.index({ owner: 1 })

export const VideoInsight = mongoose.model("VideoInsight", videoInsightSchema)
