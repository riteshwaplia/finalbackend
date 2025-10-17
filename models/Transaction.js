const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
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
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        required: true,
        index: true
    },
    transactionId: {
        type: String,
        unique: true,
        // required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentGateway: {
        type: String,
        enum: ['razorpay', 'stripe', 'paypal', 'other'],
        required: true
    },
    gatewayTransactionId: String,
    paymentMethod: String,
    paymentDetails: mongoose.Schema.Types.Mixed,
    refundDetails: mongoose.Schema.Types.Mixed,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

TransactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate transaction ID if not exists
    if (!this.transactionId) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.transactionId = `TXN${timestamp}${random}`;
    }
    
    next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);