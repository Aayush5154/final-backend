import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String,
            required: true
        },
        thumbnail: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number, // Cloudnary se info. aayegi iski
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        hls: {
            playbackUrl: String,
            status: {
                type: String,
                enum: ["pending", "processing", "ready", "unavailable"]
            },
            profile: String,
            publicId: String,
            version: Number,
            variants: [{
                _id: false,
                width: Number,
                height: Number,
                bandwidth: Number
            }],
            checkedAt: Date
        }
    },
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate) //mongoose kuch options aapko deta h ki khudse kuch plugins add karna ka and aggregate framework thoda mongodb me baad me aaya hain to isko plugin ke sath add karte hain
videoSchema.index({ isPublished: 1, createdAt: -1 });
videoSchema.index({ isPublished: 1, views: -1, createdAt: -1 });
//Ye plugin aggregation queries ke liye page-wise data lana bahut easy bana deta hai.
export const Video = mongoose.model("Video", videoSchema)
// Aggregation means processing MongoDB data in multiple steps to filter, group, join, calculate, and sort results, and mongoose-aggregate-paginate-v2 makes paginating those results easy.