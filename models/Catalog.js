const mongoose = require('mongoose');

const catalogSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
    businessProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BusinessProfile"
    },
    catalogId: String,
    name: {
        type: String,
        trim: true
    },
}, { versionKey: false, timestamps: true });

const catalogModel = mongoose.model('catalog', catalogSchema);

module.exports = catalogModel;