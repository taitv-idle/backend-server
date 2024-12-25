const mongoose = require('mongoose');
require('dotenv').config();

module.exports.dbConnect = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB connected');
    }catch(err) {
        console.log(err.message);
    }
}