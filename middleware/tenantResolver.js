const Tenant = require('../models/Tenant');

const tenantResolver = async (req, res, next) => {
  // In production, domain should come from headers
  const domain = "http://localhost:5173";

  // const userAgent = req.headers['user-agent'];
  
  // // Get client IP, even behind proxies (ngrok, render, etc.)
  // const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  try {
    const tenant = await Tenant.findOne({ domain });
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found for this domain.' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ message: 'This tenant is currently inactive.' });
    }

    req.tenant = tenant;        // Attach tenant
    // req.clientIp = ip;          // Attach IP (optional)
    // req.userAgent = userAgent;  // Attach browser info (optional)

    next();
  } catch (error) {
    console.error('❌ Tenant resolution error:', error);
    res.status(500).json({ message: 'Server error during tenant resolution.' });
  }
};

module.exports = tenantResolver;
