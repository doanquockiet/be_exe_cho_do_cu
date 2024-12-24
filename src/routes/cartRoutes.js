const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Thêm sản phẩm vào giỏ hàng
router.post('/add', authenticate, async (req, res) => {
    const { productId, quantity } = req.body;

    try {
        const userId = req.user.id;

        // Kiểm tra xem sản phẩm có tồn tại không
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Kiểm tra xem giỏ hàng đã tồn tại chưa
        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            // Nếu chưa có giỏ hàng, tạo mới
            cart = new Cart({ user: userId, items: [] });
        }

        // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
        const existingItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (existingItemIndex > -1) {
            // Nếu sản phẩm đã có, cập nhật số lượng
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            // Nếu sản phẩm chưa có, thêm vào giỏ hàng
            cart.items.push({ product: productId, quantity });
        }

        // Lưu lại giỏ hàng
        await cart.save();
        res.status(200).json({ message: 'Product added to cart', cart });
    } catch (error) {
        console.error(`[ADD TO CART] Error:`, error.message);
        res.status(500).json({ message: error.message });
    }
});

// Lấy giỏ hàng của người dùng
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: '_id name price images size category', // Select only necessary fields
        });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Xóa sản phẩm khỏi giỏ hàng
router.delete('/remove/:productId', authenticate, async (req, res) => {
    const { productId } = req.params;

    console.log(`[DELETE] /api/cart/remove/${productId}: Start`);

    try {
        const userId = req.user.id;

        // Tìm kiếm giỏ hàng của người dùng
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Xóa sản phẩm khỏi giỏ hàng
        cart.items = cart.items.filter(item => item.product.toString() !== productId);


        // Lưu lại giỏ hàng đã cập nhật
        await cart.save();

        res.status(200).json({ message: 'Product removed from cart', cart });
    } catch (error) {
        res.status(500).json({ message: 'Error removing product from cart', error: error.message });
    }
});

module.exports = router;
