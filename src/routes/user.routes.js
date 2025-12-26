import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAceessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile
} from "../controllers/user.controllers.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
  "/register",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 }
  ]),
  registerUser
);
// it is like router.post("/register", middlewares, registerUser) upload naam ka middleware use karne vale h ham 

router.post("/login", loginUser);
router.post("/logout", verifyJWT, logoutUser);// verifyJWT middleware h auth.middleware.js joki check kar rha h ki user valid h ki nahi
router.post("/refresh-token", refreshAceessToken);
router.post("/change-password", verifyJWT, changeCurrentPassword)
router.get("/current-user", verifyJWT, getCurrentUser)
router.patch("/update-account",verifyJWT, updateAccountDetails)
router.patch("/avatar", verifyJWT, upload.single("avatar"), updateUserAvatar)
router.patch("/cover-image", verifyJWT, upload.single("cover-image"), updateUserCoverImage)
//ab kahani chalu hogi kyuki data parms se lenge.
router.get("/c/:username", verifyJWT, getUserChannelProfile)
router.get("/history").get(verify)

export default router;
