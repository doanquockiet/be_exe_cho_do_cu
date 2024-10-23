const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    rating: { type: Number, required: true },
    comments: [{ type: String }],
    quantity: { type: Number, required: true },
    size: { type: String, required: true },
    category: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
