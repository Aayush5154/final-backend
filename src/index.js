// require('dotenv').config({path : './env'})
import dotenv from "dotenv" //sabse pehle dotenv import karte hain as jese hi pehli file upload ho saare environment variables available ho jaaye. 
import connectDB from "./db/index.js";
// import mongoose from "mongoose";
// import {DB_NAME} from "./contants"
import express from "express"
const app = express()
dotenv.config({
    path: './.env'
})

connectDB() //async function pura hua h to promise bhi return karega 
.then(() => {
    app.on("error", (error) => {
       console.log("Error: ", error);
       throw error
    })//ek event error ke liye listen kar rahe hain and then message print kara rahe hain

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGODB connection failed !!: ", err);
})



/*
// We will use iffes ()()
( async () => {
    try {
       await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
       app.on("error", (error) => { // express ke pass listen karna ka tarika hota h using the on usme ek event error ka event hota hai
        console.log("ERR: ", error);
        throw error
       })

       app.listen(process.env.PORT, () => {
        console.log(`App is listining on port ${process.env.PORT}`)
       })
    }catch(error){
        console.log("ERROR: ", error)
        throw error
    }
})()
*/

// ye ek approach h ki we will use the iffes or chah to functio banake call bhi ker sakte and we have used the async and await as database durse continent me rehta h to response aane me time lagta hain and sabko try actch me bhi wrap up kiya h 

