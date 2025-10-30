import mongoose from "mongoose";
import { DB_NAME } from "../contants.js";

const connectDB = async () => {
    try {
      const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
      console.log(`\n MongoDB connected !! DB Host: ${connectionInstance.connection.host}`)
    }catch(error){
        console.log("MONGODB connection FAILED", error);
        process.exit(1) // ye application kisi process pe chal rahi hogi vaha se exit kara denge
    }
}
// ya to ese karlo nahi to promise ke baad .then, .catch() kar sakte ho
export default connectDB