import mongoose, { Schema } from "mongoose";

const watchHistorySchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true
        },
        watchedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

watchHistorySchema.index({ owner: 1, video: 1 }, { unique: true });
watchHistorySchema.index({ owner: 1, watchedAt: -1 });

export const WatchHistory = mongoose.model("WatchHistory", watchHistorySchema);
