import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin : process.env.CROSS_ORIGIN, //means kon kon se origin ko allow karna hain(means kinki requests ).
    credentials : true
})) // app.use middlewares ke liye use me aata hain.
// kuch data url se aayega , kuch ka json format me , direct form me , object ke form me to
//serucity practise that we use 
app.use(express.json({limit: "16kb"})) //form bhara to jo data aaya
// pehle doc, files ke liye boy parser use karna padta tha par ab jaurat nahi padti 
//for the files a third partyy package is needed = multer (file uplaoding configure karte hain express abhi uske like ready nahi hain )
//now i want url se data jo aa rha hain (especially iske liye encoder hota hain)
// for that we need to configure that
app.use(express.urlencoded({extended : true, limit: "16kb"}))// by using the extended object ke object ke ander bhi excepth ker sakte hain 
app.use(express.static("public")) // kuch assest jeke files, images unhe yaha store karate hain
app.use(cookieParser()) // it manages the secure cookies in the user browser  

export { app }
