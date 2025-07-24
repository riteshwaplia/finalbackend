const mongoose = require('mongoose');

const flowSchema = new mongoose.Schema({
    projectId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    entryPoint: { 
        type: String,
        required: true
    },
    nodes: [mongoose.Schema.Types.Mixed],
    edges: [mongoose.Schema.Types.Mixed],
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('flow', flowSchema);