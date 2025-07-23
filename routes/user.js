const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const userController = require('../controllers/userController');
const validate = require('../middleware/validate'); 
const {
  registerSchema,
  loginSchema,
  businessProfileSchema
} = require('../validations/userValidation'); 
const { responseHandler } = require('../middleware/responseHandler');

const router = express.Router();

router.post('/register', responseHandler(userController.registerController));
router.post("/verifyOtp", responseHandler(userController.verifyOtpController));
router.post('/login', userController.authUser);
router.get('/profile', protect, userController.getUserProfile);
router.put('/profile', protect, userController.updateUserProfile);
router.get('/', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.getAllUsersForTenant);
router.post('/admin-register', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.registerUserByAdmin);
router.post('/business-profiles', protect, userController.createBusinessProfile);
router.get('/business-profiles', protect, userController.getAllBusinessProfilesForUser);
router.put('/business-profiles/:id', protect,userController.updateBusinessProfile);

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
