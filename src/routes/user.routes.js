import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"   

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount : 1
        },
        {
            name : "coverImage",
            maxCount : 1
        }
    ]), // ye fiels array accept karta hain(ye middleware hain) it runs befire registerUser yaha se sabse pehle req.
    registerUser)
// router.route("/login").post(login)

export default router