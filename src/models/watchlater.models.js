import mongoose, { Schema } from "mongoose";

const watchLaterSchema = new Schema(
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
        }
    },
    { timestamps: true }
);

watchLaterSchema.index({ owner: 1, video: 1 }, { unique: true });
watchLaterSchema.index({ owner: 1, createdAt: -1 });

export const WatchLater = mongoose.model("WatchLater", watchLaterSchema);
