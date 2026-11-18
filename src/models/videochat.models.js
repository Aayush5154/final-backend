import mongoose, { Schema } from "mongoose"

const chatMessageSchema = new Schema(
    {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true, maxlength: 12000 },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
)

const videoChatSchema = new Schema(
    {
        video: { type: Schema.Types.ObjectId, ref: "Video", required: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        messages: { type: [chatMessageSchema], default: [] }
    },
    { timestamps: true }
)

videoChatSchema.index({ video: 1, user: 1 }, { unique: true })

export const VideoChat = mongoose.model("VideoChat", videoChatSchema)
