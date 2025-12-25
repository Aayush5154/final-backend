import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js" // for to check ki user already exits 
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokenss = async (userId) => {
    // user ke through we can easily get user_id 
    try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({ validateBeforeSave : false })//refresh token ko baceknd me save kara diya

      return {accessToken, refreshToken}

    }catch (error){
     throw new ApiError(500, "something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend 
    // validation - not empty 
    // check if user already exists : username and email
    // check for images, check for avatar 
    // if available upload them on cloudinary 
    // create user object - create entry in db 
    // remove password and refresh token field from response taki user tak naa pahuche 
    // check for user creation
    // return response 


    const {fullname, username, email, password} = req.body // froms and json data are present in req.body
    console.log("email: ", email); 
    // if(fullname === ""){
    //     throw new ApiError(400, "fullname is required")
    // } //ese karke saare check kar sakte ho another method 
    if (
        [fullname, email, username, password].some((field) => 
            field?.trim() == "" )// ek bhi empty hoga to true return karega 
    ){
        throw new ApiError(400, "All fiels are compulsary or required") // Api error ka object bana liya 
    } // 2 tasks are done 

    // ab ham apne iccha se validation laga sakte h jese email me @ h ki nahi like string @ include karta h ki nahi 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email format");
    }

    // check if user already exists : username and email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }] //  ya to email ya user dono me kuch bhi mil gya to error denge
    });
     
    // findOne is used to find the first user   
    // Hamne directly User jo ki ek model h database me usse hi puch liya ki does these exists 
    // and $or ke thorugh multiple checks le sakte hain

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists!")
     }

     // check for images, check for avatar 
    //  1️⃣ req.files 
    // When you send files (like images) from the frontend — for example through a form using multipart/form-data — the middleware multer handles them and attaches them to the request object (req).
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path; // isse local path milega jaha cover image uplaoded hain on our server 
    // 2️⃣ req.files?.avatar
    // The ?. is optional chaining — it means “only try to access this if it exists”.
    // So req.files?.avatar means:
    // “If req.files exists, get the property avatar, otherwise return undefined.”
    // This helps prevent errors like
    // Cannot read properties of undefined (reading 'avatar')
    //  So req.files.avatar[0] means the first uploaded file under the field name avatar.
    // So req.files.avatar[0].path gives the file path on your server (where multer temporarily stored the uploaded file).
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar File is required!")
    }
    // Cover Image mandatory nahi hain

    // Now upload them to cloudinary 
    // already exported and configured hain
    const avatar = await uploadOnCloudinary(avatarLocalPath)// upload hone ke baad ref milega cloudinary se url milega response me 
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;
    //better approach
    if(!avatar){
        throw new ApiError(400, "Avatar File is required")
    }
    // Now lets go 
    // create user object - create entry in db 
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    //Now lets remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )// agr aapko findbyid se user mila h to chain karke select kar sakte ho .select method karke isme string pass karte h jo jo hame nahi chaiye unka naam likhke 

    // check for user creation
    if(!createdUser){
       throw new ApiError(400, "All fields are compulsory or required")
    }
    // return response 
    
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    )

}) // form or direct data recieve
const loginUser = asyncHandler(async(req, res) => {
     // req body -> data
     // check for username or email(kisi bhi ek ko check karlo)
     // find the user 
     // if not then tell u are not 
     // if yes then ->
     // password check 
     // generate access and refresh token 
     // send cookie 

     const {username, email, password} = req.body

     if(!username && !email){ //if both are misssing then only 
        throw new ApiError(400, "Username or email is required!")
     }

     // finding the user 

     const user = await User.findOne({
        $or: [{username}, {email}]
     })

     if(!user){
        throw new ApiError(404, "User does not exits")
     }

     // check for password (user model me method h already ispassword correct naam ka)
     // User ke pass mongoose se jo method milte h vo hain whereas user ek instance hame mila h jo hamne databse se liya hain
     const ispasswordValid = await user.isPasswordCorrect(password)
     if(!ispasswordValid){
        throw new ApiError(401, "Invalid user credentials")
     }
     // generate access and refresh token 
     const {accessToken, refreshToken} = await generateAccessAndRefreshTokenss(user._id) 

     //NOW WE DONT WANT KI USER KO PASSWORD AND REFRESH TOKEN MILE 
     // ya to phele vale user ko update kar do or dubara id ke thorough access karlo kyuki pehle vale me ab refresh token and access token add kiya h  
     const logidInUser = await User.findById(user._id).select("-password -refreshToken")

     // send cookie 
     const options = {
        httpOnly : true,
        secure : true, // by doing these cookies are only modified by the server not by the frontend 
     }

     return res
     .status(200)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", refreshToken, options)
     .json(
        new ApiResponse(
            200, 
            {
                user : logidInUser, 
                // accessToken, 
                // refreshToken //  may be they are not required hamne ccokies me already set ker liye hain as ..
            },
            "User logged in successfully"
        )
     )
     
})


const logoutUser = asyncHandler(async(req, res) => {
 // now to baat ab esi h ki pehle to frontend se email, username aa rha ha to hamne req.body se user ko access kar liye tha and then database se findout kar liya tha but now ab vese to kar nahi sakte nahi to koi bhi fhir durse usert ko logout kar dega isliye yaha kaam aata h middleware jo ki ham apna custom create kar sakte hain.
 // as jese hi aapne middleware cookie call kiya kia to aap res.cookie kar sakte the similarly req.cookie bhi kar sakte ho to vaha se user ka access mil sakta h req.cookie like this 
 // lets create the middleware of the auth jo ki verify karega ki user h ki nahi 

 //Now we have the access of req.user
//  req.user._id

//logout ke liye kya karunga bas refresh token undefined kar dunga db me taki jab dubara login karega to laya refresh token generate hoga.

User.findByIdAndUpdate(
    await req.user._id,
    {
        $set : {
            refreshToken : undefined
            },
    },   {
            new : true // means ab jab value access karoge to naya vala access hoga.
        }
    )

    const options = {
        httpOnly : true,
        secure : true, // by doing these cookies are only modified by the server not by the frontend 
     }

     return res
     .status(200)
     .clearCookie("accessToken", options)
     .clearCookie("refreshToken", options)
     .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAceessToken = asyncHandler(async(req, res) => {
    const incomingrefreshToken =  req.cookies.refreshToken || req.body.refreshToken
    if(!incomingrefreshToken) {
        throw new ApiError(401, "Unauthorized request!")
    }
    try {
        const decodedToken = jwt.verify(incomingrefreshToken, process.env.REFRESH_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id) // Now u have the access of the user 
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingrefreshToken !== user._id){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        // Now ab to naya generate karlo
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken, newrefreshToken} =  await generateAccessAndRefreshTokenss(user._id)   
    
        return res 
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken : newrefreshToken}, 
                "Accessed token refreshed successfully "
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }

    
})

// next step is creating the route (ye methods kab run honge)
export {registerUser,
    loginUser,
    logoutUser,
    refreshAceessToken
}

