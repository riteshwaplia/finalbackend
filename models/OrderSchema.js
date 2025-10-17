const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        required: true,
        index: true
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        index: true
    },
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    items: [{
        productId: String,
        name: String,
        quantity: Number,
        price: Number,
        currency: String,
        image: String
    }],
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        default: 0
    },
    shipping: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    shippingAddress: {
        name: String,
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String,
        phone: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentLink: {
        type: String
    },
    paymentLinkSent: {
        type: Boolean,
        default: false
    },
    metaOrderId: {
        type: String,
        index: true
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

OrderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate order number if not exists
    if (!this.orderNumber) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `ORD${timestamp}${random}`;
    }
    
    next();
});

module.exports = mongoose.model('Order', OrderSchema);