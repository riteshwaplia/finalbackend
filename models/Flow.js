// server/models/Flow.js
const mongoose = require('mongoose');

const FlowSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    userId: { // Creator/Owner of the flow
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: false, // Not unique globally, but unique per project/user/tenant
    },
    // The keyword that triggers this flow (e.g., "hi", "support", "order status")
    // Can be null if the flow is manually triggered or a default fallback.
    triggerKeyword: {
        type: String,
        trim: true,
        sparse: true, // Allows multiple documents to have null or undefined triggerKeyword
        // Consider making it unique per project if you only want one flow per keyword per project
        // unique: true, // If only one flow per keyword per project is allowed
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    // The actual flow structure (nodes and edges from reactflow)
    nodes: {
        type: Array, // Array of node objects
        default: [],
    },
    edges: {
        type: Array, // Array of edge objects
        default: [],
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'draft',
    },
    // Optional: Keep track of which WhatsApp phone number this flow is active for
    // This could also be managed in the Project model or a separate mapping.
    // For now, it's a simple reference.
    whatsappPhoneNumberId: {
        type: String, // Meta's phone number ID
        required: false, // A flow might not be active on any number yet
    },
}, { timestamps: true }); // Adds createdAt and updatedAt fields

// Add a compound unique index if you want to ensure only one flow with a given name
// OR one flow with a given triggerKeyword per project/user/tenant
FlowSchema.index({ projectId: 1, userId: 1, tenantId: 1, name: 1 }, { unique: true });
// If triggerKeyword should be unique per project/user/tenant, add another index:
// FlowSchema.index({ projectId: 1, userId: 1, tenantId: 1, triggerKeyword: 1 }, { unique: true, sparse: true });


module.exports = mongoose.model('Flow', FlowSchema);
