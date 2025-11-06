import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler(async(req, _, next) => {
    // agr aapke pass true login h means sahi access and refresh token h to ek naya object add kar sakte ho req.User like this
    try {
        // do tarah se token aa sakte h ek to cookie ke through and ek custom header bhi bhej sakta hain jo ki maily Authorization naam se aata hai to yaha se token mil gya 
        const token = req.cookies?.accessToken || req.header
        ("Authorization")?.replace("Bearer ", "")

        if(!token){
            throw new ApiError(401, "Unauthorized request")
        }
        // now phele jab generateaccess token kiya tha to _id karke tabhi user ki id save kar di thi ligin ke time to use dubara decode karna h bas 
        // jwt me method hota h verify
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            throw new ApiError(401, "Invalid access token")
        }
    
        req.user = user;
        next()
        // ek tarah se tumne ek middlware bana diya jo ki kya kar rha h req me user ek object insert kar rha h like req.user to bas finallly ab tumhare pass access hain user ka user easily logout kara sakte ho 
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})

// upper is export kar diya 