import { Router } from "express";
import { loginUser, logoutUser, refreshAceessToken, registerUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js" 
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { refreshAceessToken } from "../controllers/user.controllers.js";

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
    ]), // ye fiels array accept karta hain(ye middleware hain) it runs before registerUser yaha se sabse pehle req.
    registerUser)
// router.route("/login").post(login)

// Multer runs first → processes files → attaches data to the request → then registerUser runs.
// req.files = {
//   avatar: [ { filename: "1730809159931-profile.png", ... } ],
//   coverImage: [ { filename: "1730809160232-banner.jpg", ... } ]
// }
router.route("/login").post(loginUser)

// secured routes  
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAceessToken)

export default router