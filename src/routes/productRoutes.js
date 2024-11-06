// routes/productRoutes.js
const express = require('express');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Add new product endpoint
router.post('/', authenticate, async (req, res) => {
    const { name, image, price, rating, quantity, size, category, description } = req.body;

    // Validate required fields
    if (!name || !image || !price || !rating || !quantity || !size || !category || !description) {
        return res.status(400).json({
            message: 'Please provide all required fields: name, image, price, rating, quantity, size, category, and description.'
        });
    }

    const product = new Product({
        name,
        image,
        price,
        rating,
        quantity,
        size,
        category,
        description
    });

    try {
        // Save the product to the database
        const savedProduct = await product.save();
        res.status(201).json({ message: 'Product added successfully!', product: savedProduct });
    } catch (error) {
        // Handle validation or database errors
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

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
module.exports = router;
