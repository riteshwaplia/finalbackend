const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    businessProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessProfile',
        required: true,
        index: true
    },
    type: { 
        type: String,
        enum: ['TEMPLATE', 'CAROUSEL'],
        default: 'TEMPLATE',
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        trim: true
    },
    language: {
        type: String,
        required: true,
        trim: true
    },
    components: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    metaTemplateId: {
        type: String,
        unique: true,
        sparse: true
    },
    metaStatus: {
        type: String,
        default: 'PENDING_REVIEW'
    },
    metaCategory: {
        type: String,
        trim: true
    },
    isSynced: {
        type: Boolean,
        default: false
    },
    lastSyncedAt: {
        type: Date
    },
    otp_type: {
        type: String,
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

TemplateSchema.index(
  { metaTemplateId: 1, businessProfileId: 1 },
  { unique: true, partialFilterExpression: { metaTemplateId: { $type: "string" } } }
);
TemplateSchema.index(
  { businessProfileId: 1, name: 1, language: 1 },
  { unique: true }
);

TemplateSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Template', TemplateSchema);
