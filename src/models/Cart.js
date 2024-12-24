const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Liên kết với user
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Liên kết với sản phẩm
            quantity: { type: Number, required: true, default: 1 }, // Số lượng sản phẩm
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
