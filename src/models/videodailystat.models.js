import mongoose, { Schema } from "mongoose";

const videoDailyStatSchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        // UTC date key in YYYY-MM-DD format so daily aggregation is queryable
        date: {
            type: String,
            required: true
        },
        views: {
            type: Number,
            default: 0,
            min: 0
        },
        watchTime: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
);

videoDailyStatSchema.index({ video: 1, date: 1 }, { unique: true });
videoDailyStatSchema.index({ owner: 1, date: 1 });

export const VideoDailyStat = mongoose.model("VideoDailyStat", videoDailyStatSchema);
