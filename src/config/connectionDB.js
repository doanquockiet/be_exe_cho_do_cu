import 'dotenv/config';

import mongoose from "mongoose";

const connectionDB = async () => {
    try {
        if (process.env.MONGO_URI) {
            const conn = await mongoose.connect(process.env.MONGO_URI)
            console.log(`Mongo db connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
        } else {
            console.log("MONGO_URL Is Undefined");
        }
    } catch (error) {
        console.log("Connect Fail With Error: \n", error);
    }
}

export default connectionDB;