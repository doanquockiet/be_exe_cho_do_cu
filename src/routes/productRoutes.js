// routes/productRoutes.js
const express = require('express');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Add Product - Protected Route
router.post('/', authenticate, async (req, res) => {
    const { name, image, rating, comments, quantity, size } = req.body;

    const product = new Product({ name, image, rating, comments, quantity, size });

    try {
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Sửa sản phẩm
router.put('/:id', authenticate, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa sản phẩm
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Lấy tất cả sản phẩm
router.get('/', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

module.exports = router;
