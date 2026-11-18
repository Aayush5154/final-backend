import mongoose, { Schema } from "mongoose";

const watchProgressSchema = new Schema(
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
        progress: {
            type: Number,
            default: 0,
            min: 0
        },
        duration: {
            type: Number,
            default: 0,
            min: 0
        },
        completed: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

watchProgressSchema.index({ owner: 1, video: 1 }, { unique: true });
watchProgressSchema.index({ owner: 1, updatedAt: -1 });

export const WatchProgress = mongoose.model("WatchProgress", watchProgressSchema);
