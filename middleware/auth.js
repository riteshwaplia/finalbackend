const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedTokenSchema = require('../models/BlacklistedTokenSchema');
// old protect
// const protect = async (req, res, next) => {
//     let token;
//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//         try {
//             token = req.headers.authorization.split(' ')[1];
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);
//             const user = await User.findById(decoded.id).select('-password');

//             if (!user) {
//                 return res.status(401).json({ message: 'Not authorized, user not found' });
//             }

//             // Ensure user belongs to the resolved tenant
//             if (!req.tenant || user.tenantId.toString() !== req.tenant._id.toString()) {
//                 return res.status(403).json({ message: 'Not authorized for this tenant.' });
//             }

//             req.user = user;
//             next();
//         } catch (error) {
//             console.error(error);
//             res.status(401).json({ message: 'Not authorized, token failed' });
//         }
//     }
//     if (!token) {
//         res.status(401).json({ message: 'Not authorized, no token' });
//     }
// };

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    // Check if token is blacklisted
    const isBlacklisted = await BlacklistedTokenSchema.findOne({ token });
    if (isBlacklisted) {
        return res.status(401).json({ message: 'Token has been logged out' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user || user.tenantId.toString() !== req.tenant._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this tenant.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};


const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };