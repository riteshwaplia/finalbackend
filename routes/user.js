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
const { responseHandler } = require('../middleware/responseHandler');

const router = express.Router();

router.post('/register',validate(registerSchema), responseHandler(userController.registerController));
router.post("/verifyOtp",validate(verifyOtpSchema), responseHandler(userController.verifyOtpController));
router.post('/login',validate(loginSchema), userController.authUser);
router.get('/profile', protect,validate(getUserProfileSchema), userController.getUserProfile);
router.put('/profile', protect,validate(updateUserProfileSchema), userController.updateUserProfile);
router.get('/', protect, authorizeRoles('tenant_admin', 'super_admin'),validate(getUsersByTenantSchema), userController.getAllUsersForTenant);
router.post('/admin-register', protect, authorizeRoles('tenant_admin', 'super_admin'),validate(registerUserByAdminSchema), userController.registerUserByAdmin);

router.post('/business-profiles',protect,validate(businessProfileSchema),userController.createBusinessProfile);

router.get('/business-profiles', protect,validate(getAllBusinessProfilesSchema), userController.getAllBusinessProfilesForUser);

router.put('/business-profiles/:id', protect,validate(updateBusinessProfileSchema), userController.updateBusinessProfile);

// router.delete('/business-profiles/:id', protect, userController.deleteBusinessProfile); // optional

module.exports = router;
