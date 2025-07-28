const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const userController = require('../controllers/userController');
const validate = require('../middleware/validate'); 
const {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  businessProfileSchema,
  getAllBusinessProfilesSchema,
  updateBusinessProfileSchema,
  registerUserByAdminSchema,
  getUsersByTenantSchema,
  updateUserProfileSchema,
  getUserProfileSchema
} = require('../validations/userValidation'); 
const {responseHandler} = require('../middleware/responseHandler');

const router = express.Router();

router.post('/register',validate(registerSchema), responseHandler(userController.registerController));
router.post("/verifyOtp", responseHandler(userController.verifyOtpController));
router.post('/login',validate(loginSchema), userController.authUser);
router.post('/logout', protect, userController.logoutUser);
router.get('/profile', protect, userController.getUserProfile);
router.put('/profile', protect,validate(updateUserProfileSchema), userController.updateUserProfile);
router.get('/', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.getAllUsersForTenant);
router.post('/admin-register', protect, authorizeRoles('tenant_admin', 'super_admin'),validate(registerUserByAdminSchema), userController.registerUserByAdmin);
router.post('/business-profiles',protect,validate(businessProfileSchema),userController.createBusinessProfile);
router.get('/business-profiles', protect, userController.getAllBusinessProfilesForUser);
router.put('/reset-password', protect, userController.resetPasswordController);
router.post('/forgot-password', responseHandler(userController.forgotPasswordController));
router.post('/update-password-with-otp', responseHandler(userController.updatePasswordWithOtpController));
router.put('/update-self/:userId', protect, responseHandler(userController.updateUserController));
router.put('/business-profiles/:id', protect, validate(updateBusinessProfileSchema), responseHandler(userController.updateBusinessProfileController));

module.exports = router;
