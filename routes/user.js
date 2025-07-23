const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const userController = require('../controllers/userController');
const validate = require('../middleware/validate'); 
const {
  registerSchema,
  loginSchema,
  businessProfileSchema
} = require('../validations/userValidation'); 

const router = express.Router();

// ===================== Public Routes =====================

// User registration (public)
router.post('/register', validate(registerSchema), userController.registerUser);

// User login (public)
router.post('/login', validate(loginSchema), userController.authUser);

// ===================== Protected Routes =====================

// Get user profile
router.get('/profile', protect, userController.getUserProfile);

// Update user profile
router.put('/profile', protect, userController.updateUserProfile);

// Get all users (tenant admin only)
router.get(
  '/',
  protect,
  authorizeRoles('tenant_admin', 'super_admin'),
  userController.getAllUsersForTenant
);

// Admin creates new user
router.post(
  '/admin-register',
  protect,
  authorizeRoles('tenant_admin', 'super_admin'),
  validate(registerSchema), // same validation as normal register
  userController.registerUserByAdmin
);

// ===================== Business Profile Routes =====================

// Create business profile
router.post(
  '/business-profiles',
  protect,
  validate(businessProfileSchema),
  userController.createBusinessProfile
);

// Get all business profiles for current user
router.get('/business-profiles', protect, userController.getAllBusinessProfilesForUser);

// Update business profile
router.put('/business-profiles/:id', protect, userController.updateBusinessProfile);

// router.delete('/business-profiles/:id', protect, userController.deleteBusinessProfile); // optional

module.exports = router;
