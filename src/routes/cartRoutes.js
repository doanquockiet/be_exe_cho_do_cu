const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Thêm sản phẩm vào giỏ hàng
router.post('/add', authenticate, async (req, res) => {
    const { productId, quantity } = req.body;

    try {
        if (quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be greater than 0' });
        }

        const userId = req.user.id;

        // Kiểm tra xem sản phẩm có tồn tại và đủ số lượng không
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        // Kiểm tra xem giỏ hàng đã tồn tại chưa
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
        const existingItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (existingItemIndex > -1) {
            // Nếu sản phẩm đã có, cập nhật số lượng
            const totalQuantity = cart.items[existingItemIndex].quantity + quantity;
            if (totalQuantity > product.stock) {
                return res.status(400).json({ message: 'Not enough stock available' });
            }
            cart.items[existingItemIndex].quantity = totalQuantity;
        } else {
            // Nếu sản phẩm chưa có, thêm vào giỏ hàng
            cart.items.push({ product: productId, quantity });
        }

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
            select: '_id name price images size category',
        });

        if (!cart || cart.items.length === 0) {
            return res.status(200).json({ message: 'Your cart is empty', items: [] });
        }

        // Lọc các sản phẩm không hợp lệ (nếu sản phẩm bị xóa khỏi DB)
        cart.items = cart.items.filter(item => item.product);

        res.status(200).json(cart);
    } catch (error) {
        console.error(`[GET CART] Error:`, error.message);
        res.status(500).json({ message: 'An error occurred while retrieving the cart' });
    }
});

// Xóa sản phẩm khỏi giỏ hàng
router.delete('/remove/:productId', authenticate, async (req, res) => {
    const { productId } = req.params;

    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        // Xóa sản phẩm khỏi giỏ hàng
        cart.items.splice(itemIndex, 1);
        await cart.save();

        res.status(200).json({ message: 'Product removed from cart', cart });
    } catch (error) {
        console.error(`[REMOVE FROM CART] Error:`, error.message);
        res.status(500).json({ message: 'Error removing product from cart' });
    }
});

module.exports = router;
