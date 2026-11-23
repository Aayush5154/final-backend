import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new mongoose.Schema({
    content : {
        type : String, 
        required : true
    },
    video : {
        type : Schema.Types.ObjectId,
        ref : "Video"
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    parent : {
        type : Schema.Types.ObjectId,
        ref : "Comment",
        default : null
    }
}, {timestamps : true})

commentSchema.plugin(mongooseAggregatePaginate)// ek page me kaha se kaha tak comments dene hain bas itna hi kaam hain 

commentSchema.index({ video: 1, createdAt: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ owner: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", commentSchema)
