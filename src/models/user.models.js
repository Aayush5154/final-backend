import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new mongoose.Schema(
    {
        username : {
            type : String,
            required : true,
            unique : true,
            trim : true,
            lowercase : true,
            index : true // if we want to make it searchable for optimisation
        },
        email : {
            type : String,
            required : true,
            unique : true,
            trim : true,
            lowercase : true,
        },
        fullname : {
            type : String,
            required : true,
            trim : true,
            index : true // if we want to make it searchable for optimisation
        },
        avatar : {
            type : String, //cloudinary url 
            required : true
        },
        coverImage : {
            type : String
        },
        watchHistory : [{
            type : Schema.Types.ObjectId,
            ref : "Video"
        }],
        password : {
            type : String,
            required : [true, 'Password is required']
        },
        refreshToken : {
            type : String
        }
    },
    {
        timestamps : true
    }
)

userSchema.pre("save", async function (next) { // pre is a hook     
    if(!this.isModified("password")) return // this.isModifies hame ye method yaha inbuilt milta hain 
    this.password = await bcrypt.hash(this.password, 10) // 10 to no. of rounds hain
    next()
})//save ek middleware hain
//jis tarah se middlewares bana sakte h us tarah se hi custom method design kar sakte hain 
userSchema.methods.isPasswordCorrect = async function (password) {
    // bcrypt library aapka password encrypt kar sakti h to simultaneoulsy check bhi kar sakti hain
    return await bcrypt.compare(password, this.password) // pehla password to jo user bhej rha h and dusra this.password jo database me store hain to ye un dono to compare ker ke response deta hain and return value boolen aati hain true or false me
}  

userSchema.methods.generateAccessToken = function(){
     return jwt.sign(
        {
            _id : this._id, // ye baad me kaam aayge auth.middlewares.js me 
            email : this.email, 
            username : this.username,
            fullname : this.fullname 
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY // expireIn in built milta hain 
        }
     )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id : this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY // expireIn in built milta hain 
        }
     )
}

export const User = mongoose.model("User", userSchema)
