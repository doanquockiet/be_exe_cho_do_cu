const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { authenticate } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

const router = express.Router();

router.post('/checkout', authenticate, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log("[CHECKOUT] Request Body:", req.body);

        const productIds = req.body.cartItems.map(item => item.productId);
        const userId = req.user.id;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            throw new Error('Danh sách sản phẩm không hợp lệ');
        }

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            throw new Error('Giỏ hàng trống');
        }

        console.log("[CHECKOUT] Cart Items:", cart.items);

        const selectedItems = cart.items.filter((item) => {
            if (!item.product || !item.product._id) {
                console.error("[CHECKOUT] Product is undefined for item:", item);
                return false;
            }
            return productIds.includes(item.product._id.toString());
        });

        if (selectedItems.length === 0) {
            throw new Error('Không có sản phẩm nào được chọn');
        }

        let totalAmount = 0;
        const productsToDeleteFromCart = []; // Danh sách sản phẩm cần xóa khỏi các giỏ hàng

        for (const item of selectedItems) {
            const product = await Product.findById(item.product._id).session(session);
            if (!product) {
                throw new Error(`Sản phẩm với ID "${item.product._id}" không tồn tại`);
            }

            if (product.quantity < item.quantity) {
                throw new Error(`Sản phẩm "${product.name}" không đủ số lượng`);
            }

            totalAmount += product.price * item.quantity;
            product.quantity -= item.quantity;

            // Kiểm tra nếu số lượng giảm xuống 0, thêm sản phẩm vào danh sách cần xóa
            if (product.quantity === 0) {
                productsToDeleteFromCart.push(product._id);
            }

            await product.save({ session });
        }

        // Tạo đơn hàng
        const order = new Order({
            user: userId,
            items: selectedItems.map((item) => ({
                product: item.product._id,
                quantity: item.quantity,
            })),
            totalAmount,
        });
        await order.save({ session });

        // Cập nhật giỏ hàng của người dùng hiện tại
        cart.items = cart.items.filter(
            (item) => !productIds.includes(item.product._id.toString())
        );
        await cart.save({ session });

        // Xóa sản phẩm hết hàng khỏi các giỏ hàng khác
        if (productsToDeleteFromCart.length > 0) {
            console.log("[CHECKOUT] Xóa các sản phẩm hết hàng khỏi giỏ hàng:", productsToDeleteFromCart);
            await Cart.updateMany(
                { "items.product": { $in: productsToDeleteFromCart } },
                { $pull: { items: { product: { $in: productsToDeleteFromCart } } } },
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Thanh toán thành công', order });
    } catch (error) {
        console.error("[CHECKOUT ERROR]:", error.message);
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
