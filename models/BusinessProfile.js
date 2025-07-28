const mongoose = require('mongoose');

const BusinessProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    businessAddress: {
        type: String,
        trim: true,
        default: ''
    },
    metaAccessToken: {
        type: String,
        required: true,
        trim: true
    },
    metaAppId: {
        type: String,
        trim: true,
        default: ''
    },
    metaBusinessId: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique combination of businessId per user per tenant
// ❌ REMOVE this (no longer needed):
// BusinessProfileSchema.index({ metaBusinessId: 1, userId: 1, tenantId: 1 }, { unique: true, name: 'unique_business_per_user_tenant' });

// ✅ ADD this instead:
BusinessProfileSchema.index({ tenantId: 1 }, { unique: true, name: 'one_business_profile_per_tenant' });


// Index for faster querying of user's business profiles
BusinessProfileSchema.index({ userId: 1, tenantId: 1 });

// Update timestamp on save
BusinessProfileSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BusinessProfile', BusinessProfileSchema);