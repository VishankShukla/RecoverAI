const mongoDB = require('mongoose');

async function connectDB() {
    try {
        await mongoDB.connect(process.env.MONGO_URI);
        console.log("Database Connected Successfully");
    } catch (err) {
        console.error("Database Error", err);
        process.exit(1);
    }
}

module.exports = connectDB;
