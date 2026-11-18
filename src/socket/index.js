import { Server } from "socket.io"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { User } from "../models/user.models.js"

const USER_ROOM_PREFIX = "user:"
const VIDEO_ROOM_PREFIX = "video:"
const TWEETS_ROOM = "tweets"

let io = null

const parseCookies = (cookieHeader = "") =>
    cookieHeader.split(";").reduce((cookies, part) => {
        const separator = part.indexOf("=")
        if (separator === -1) return cookies

        const key = part.slice(0, separator).trim()
        if (!key) return cookies

        try {
            cookies[key] = decodeURIComponent(part.slice(separator + 1).trim())
        } catch {
            cookies[key] = part.slice(separator + 1).trim()
        }

        return cookies
    }, {})

const authenticateSocket = async (socket) => {
    const cookieToken = parseCookies(socket.handshake.headers?.cookie).accessToken
    const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
        cookieToken

    if (!token) return null

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        if (!decoded?._id || !mongoose.isValidObjectId(decoded._id)) return null

        const user = await User.findById(decoded._id).select("_id").lean()
        return user ? user._id.toString() : null
    } catch {
        return null
    }
}

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CROSS_ORIGIN,
            credentials: true
        }
    })

    io.use(async (socket, next) => {
        socket.data.userId = await authenticateSocket(socket)
        next()
    })

    io.on("connection", (socket) => {
        socket.join(TWEETS_ROOM)

        if (socket.data.userId) {
            socket.join(`${USER_ROOM_PREFIX}${socket.data.userId}`)
        }

        socket.on("video:join", (videoId) => {
            if (typeof videoId !== "string" || !mongoose.isValidObjectId(videoId)) return
            socket.join(`${VIDEO_ROOM_PREFIX}${videoId}`)
        })

        socket.on("video:leave", (videoId) => {
            if (typeof videoId !== "string" || !mongoose.isValidObjectId(videoId)) return
            socket.leave(`${VIDEO_ROOM_PREFIX}${videoId}`)
        })
    })

    return io
}

const getIO = () => io

const emitToUser = (userId, event, payload) => {
    if (!io || !userId) return
    io.to(`${USER_ROOM_PREFIX}${userId.toString()}`).emit(event, payload)
}

const emitToVideo = (videoId, event, payload) => {
    if (!io || !videoId) return
    io.to(`${VIDEO_ROOM_PREFIX}${videoId.toString()}`).emit(event, payload)
}

const emitToTweetViewers = (event, payload) => {
    if (!io) return
    io.to(TWEETS_ROOM).emit(event, payload)
}

export {
    initSocket,
    getIO,
    emitToUser,
    emitToVideo,
    emitToTweetViewers
}
