// src/config/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import productRoutes from '../routes/productRoutes.js'
import connectionDB from './connectionDB.js'; // Đường dẫn đến connectionDB
import userRoutes from '../routes/userRoutes.js';
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
