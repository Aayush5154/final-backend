import mongoose, { Schema } from "mongoose";

const tweetCommentSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },
        tweet: {
            type: Schema.Types.ObjectId,
            ref: "Tweet",
            required: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        parent: {
            type: Schema.Types.ObjectId,
            ref: "TweetComment",
            default: null
        }
    },
    { timestamps: true }
)

tweetCommentSchema.index({ tweet: 1, createdAt: 1 });
tweetCommentSchema.index({ parent: 1 });

export const TweetComment = mongoose.model("TweetComment", tweetCommentSchema)
