import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CROSS_ORIGIN, //means kon kon se origin ko allow karna hain(means kinki requests ).
    credentials: true
})) // app.use middlewares ke liye use me aata hain.
// kuch data url se aayega , kuch ka json format me , direct form me , object ke form me to
//serucity practise that we use 
app.use(express.json({ limit: "16kb" })) //form bhara to jo data aaya
// pehle doc, files ke liye boy parser use karna padta tha par ab jaurat nahi padti 
//for the files a third partyy package is needed = multer (file uplaoding configure karte hain express abhi uske like ready nahi hain )
//now i want url se data jo aa rha hain (especially iske liye encoder hota hain)
// for that we need to configure that
app.use(express.urlencoded({ extended: true, limit: "16kb" }))// by using the extended object ke object ke ander bhi excepth ker sakte hain 
app.use(express.static("public")) // kuch assest jeke files, images unhe yaha store karate hain
app.use(cookieParser()) // it manages the secure cookies in the user browser  

//routes import (segregation)
import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
import healthcheckRouter from "./routes/healthcheck.routes.js"

//routes declaration
// app.get (ye pehle karte the jabtak router import nahi kiya tha ab router ko alg ker diya h to usko laane ke middleware laana padega)
app.use("/api/v1/user", userRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/dashboard", dashboardRouter)
app.use("/api/v1/healthcheck", healthcheckRouter)

export { app }
