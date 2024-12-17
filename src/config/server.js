// src/config/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors')

const productRoutes = require("../routes/productRoutes.js") 
const connectionDB = require ("./connectionDB.js" ) // Đường dẫn đến connectionDB
const userRoutes = require("../routes/userRoutes.js")
dotenv.config();
const app = express();

// Kết nối MongoDB
connectionDB();
app.use(cors());
// Middleware để parse JSON
app.use(express.json());

// Các route cho sản phẩm
app.use('/api/products', productRoutes);

app.use('/api/users', userRoutes);
// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port localhost:${PORT}`);
});
