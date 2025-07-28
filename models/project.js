const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
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
    name: {
        type: String,
        required: true,
        trim: true
    },
    isWhatsappVerified: {
        type: Boolean,
        default: false
    },
    assistantName: {
        type: String,
        trim: true,
        default: ''
    },
    businessProfileId: { // Link to the specific BusinessProfile (WhatsApp Business Account) this project uses
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessProfile',
        required: true,
        index: true
    },
    metaPhoneNumberID: { // Meta's internal ID for the phone number (e.g., "687854254405676")
        type: String,
        trim: true,
        default: ''
    },
    whatsappNumber: { // The display phone number (e.g., "+1 234 567 8901")
        type: String,
        trim: true,
        default: ''
    },
    activePlan: { // e.g., "PRO"
        type: String,
        trim: true,
        default: ''
    },
    planDuration: { // Numerical value for plan duration
        type: String,
        default: 0
    },
    // NEW FIELDS for WhatsApp Business Profile details (per phone number)
    about: {
        type: String,
        trim: true,
        maxlength: 139, // Meta's limit for 'about'
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    websites: {
        type: [String], // Array of strings for websites
        default: []
    },
    vertical: { // Industry category
        type: String,
        trim: true,
        default: ''
    },
    profilePictureUrl: { // URL of the profile picture on Meta's CDN
        type: String,
        trim: true,
        default: ''
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

// This helps prevent a user from creating two projects with the same name linked to the same business profile
ProjectSchema.index({ name: 1, userId: 1, businessProfileId: 1 }, { unique: true });

// Update `updatedAt` on save
ProjectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
