// require('dotenv').config({path : './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";

dotenv.config({
    Path : './env'
})

connectDB()



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

