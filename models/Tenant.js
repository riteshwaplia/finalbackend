const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    domain: { type: String, required: true, unique: true }, // e.g., 'tenant1.com', 'tenant2.org'
    faviconUrl: { type: String, default: 'https://placehold.co/16x16/cccccc/000000?text=Fav' },
    websiteName: { type: String, required: true },
    isActive: { type: Boolean, default: true }, // On/Off control
    isSuperAdmin: { type: Boolean, default: false }, // Only the first tenant can be super admin
     metaApi: {
        wabaId: { type: String, default: '' },
        accessToken: { type: String, default: '' }, // Highly sensitive, consider encryption in production DB
        appId: { type: String, default: '' },
        facebookUrl: { type: String, default: 'https://graph.facebook.com' },
        graphVersion: { type: String, default: 'v19.0' }, // Default for new tenants
    },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Tenant', TenantSchema);
