import {asyncHandler} from "../utils/asyncHandler.js"

const registerUser = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        message : "ok"
    })// just like res.send
})

// next step is creating the route (ye methods kab run honge)
export {registerUser}

