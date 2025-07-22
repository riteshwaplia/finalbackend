// server/models/Template.js
const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    userId: { // The user who created/owns this template (or imported it)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // projectId is removed as templates will now be global for the user/tenant
 businessProfileId: { // NEW: Link to the specific BusinessProfile (WABA) this template belongs to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessProfile',
        required: true,
        index: true
    },
    name: { // Template name from Meta
        type: String,
        required: true,
        trim: true
    },
    category: { // e.g., AUTHENTICATION, MARKETING, UTILITY
        type: String,
        trim: true
    },
    language: { // e.g., en_US
        type: String,
        required: true,
        trim: true
    },
    components: { // Structure of the template (e.g., HEADER, BODY, FOOTER, BUTTONS)
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    // Meta API specific fields for synchronization
    metaTemplateId: { // This is the 'id' field from Meta API response for a template
        type: String,
        unique: true, // Should be unique globally across all tenants for robust sync
        sparse: true // Allows null values, so templates created locally before Meta submission don't need this
    },
    metaStatus: { // Status from Meta: e.g., APPROVED, PENDING, REJECTED
        type: String,
        default: 'PENDING_REVIEW' // Initial status if created locally
    },
    metaCategory: { // Category from Meta, might differ from local 'category' for flexibility
        type: String,
        trim: true
    },
    // Local tracking fields
    isSynced: { // True if it exists on Meta, false if local-only
        type: Boolean,
        default: false
    },
    lastSyncedAt: {
        type: Date
    },
     type: {
        type: String,
        enum: ['STANDARD', 'CAROUSEL'], // Or other types like 'FLOW' if you add them
        default: 'STANDARD',
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

// Compound index for efficient lookup by name and language within a tenant for a user
TemplateSchema.index(
  { metaTemplateId: 1, businessProfileId: 1 },
  { unique: true, partialFilterExpression: { metaTemplateId: { $type: "string" } } }
);
TemplateSchema.index(
  { businessProfileId: 1, name: 1, language: 1 },
  { unique: true }
);


// TemplateSchema.index(
//   { tenantId: 1, businessProfileId: 1, name: 1, language: 1 },
//   { unique: true }
// );
// Ensure updatedAt is updated on save
TemplateSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Template', TemplateSchema);

