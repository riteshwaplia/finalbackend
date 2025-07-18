// const mongoose = require('mongoose');

// const flowSchema = new mongoose.Schema({
//     projectId: mongoose.Schema.Types.ObjectId,
//     userId: mongoose.Schema.Types.ObjectId,
//     entryPoint: { 
//         type: String,
//         required: true
//     },
//     nodes: [mongoose.Schema.Types.Mixed],
//     edges: [mongoose.Schema.Types.Mixed],
// }, {
//     timestamps: true,
//     versionKey: false
// });

// module.exports = mongoose.model('flow_builder', flowSchema);

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
    name: { // Display name of the flow (e.g., "Welcome Message Flow")
        type: String,
        required: true,
        trim: true,
    },
    // The keyword that triggers this flow (e.g., "hi", "support", "order status")
    // This is what was referred to as 'entryPoint' in your provided code.
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
    // whatsappPhoneNumberId: {
    //     type: String,
    //     required: false,
    // },
}, { timestamps: true }); // Adds createdAt and updatedAt fields

// Compound unique index for name within a project, user, and tenant
FlowSchema.index({ projectId: 1, userId: 1, tenantId: 1, name: 1 }, { unique: true });

// If triggerKeyword should be unique per project/user/tenant for 'active' flows:
// FlowSchema.index({ projectId: 1, userId: 1, tenantId: 1, triggerKeyword: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

// Export the model as 'Flow'
module.exports = mongoose.models.Flow || mongoose.model('Flow', FlowSchema);
