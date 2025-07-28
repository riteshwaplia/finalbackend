const Tenant = require('../models/Tenant');

const tenantResolver = async (req, res, next) => {
  // In production, domain should come from headers
  // const domain = req.headers.origin;
 
  const domain =  req.headers.origin || req.headers.host;


  try {
    const tenant = await Tenant.findOne({ domain });
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found for this domain.' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ message: 'This tenant is currently inactive.' });
    }

    req.tenant = tenant; 

    next();
  } catch (error) {
    console.error('❌ Tenant resolution error:', error);
    res.status(500).json({ message: 'Server error during tenant resolution.' });
  }
};

module.exports = tenantResolver;
