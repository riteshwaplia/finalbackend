const Tenant = require('../models/Tenant');

const tenantResolver = async (req, res, next) => {
    // In production, get domain from req.headers.host
    // For local testing, you might pass it in a header or query param for simulation
    const domain = req.headers.origin;
console.log("first", domain);
  

    try {
        const tenant = await Tenant.findOne({ domain });
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found for this domain.' });
        }
        if (!tenant.isActive) {
            return res.status(403).json({ message: 'This tenant is currently inactive.' });
        }
        req.tenant = tenant; // Attach tenant object to request
        next();
    } catch (error) {
        console.error('Tenant resolution error:', error);
        res.status(500).json({ message: 'Server error during tenant resolution.' });
    }
};

module.exports = tenantResolver;