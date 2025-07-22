const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const userController = require('../controllers/userController');
const responseHandler = require('../middleware/responseHandler');

const router = express.Router();

// User registration for the current tenant (public)
router.post('/register', responseHandler(userController.registerUser));

// User login for the current tenant (public)
router.post('/login', responseHandler(userController.authUser));

// Get user profile (protected, tenant-specific)
router.get('/profile', protect, userController.getUserProfile);

// Update user profile (protected, tenant-specific)
router.put('/profile', protect, userController.updateUserProfile);

// Get all users for the current tenant (protected, tenant_admin only)
router.get('/', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.getAllUsersForTenant);

// Register a new user by a tenant admin (protected, tenant_admin only)
router.post('/admin-register', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.registerUserByAdmin);
// router.get('/my-business-profile', protect, userController.getCurrentUserBusinessProfile);
// router.put('/my-business-profile', protect, userController.updateCurrentUserBusinessProfile);

router.post('/business-profiles', protect, userController.createBusinessProfile);
router.get('/business-profiles', protect, userController.getAllBusinessProfilesForUser); // List all business profiles for the current user
router.put('/business-profiles/:id', protect,userController.updateBusinessProfile); // :id is businessProfileId
// router.delete('/business-profiles/:id', protect,userController.delete); // :id is businessProfileId

module.exports = router