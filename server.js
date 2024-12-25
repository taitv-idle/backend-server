const express = require('express');
require('dotenv').config();
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const {dbConnect} = require("./utiles/db");

app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

app.use('/api', require('./routes/authRoutes'));


app.get('/', (req, res) => {
    res.send('Welcome to the server');
})


app.listen(process.env.PORT, async () => {
    await dbConnect();
    console.log(`Server is running on port ${process.env.PORT}`);
});