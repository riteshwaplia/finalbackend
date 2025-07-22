const { statusCode, resMessage } = require('../config/constants');
const BusinessProfile = require('../models/BusinessProfile');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user for the current tenant
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req) => {
    const { username, email, password } = req.body;
    const tenantId = req.tenant._id;

    const userExists = await User.findOne({ email, tenantId });
    if (userExists) {
        return {
            statusCode: 400,
            success: false,
            message: 'User with that email already exists for this tenant.',
            data: null
        };
    }

    const user = await User.create({
        tenantId,
        username,
        email,
        password,
        role: 'user' // default role
    });

    if (!user) {
        return {
            statusCode: 400,
            success: false,
            message: 'Invalid user data',
            data: null
        };
    }

    return {
        statusCode: 201,
        success: true,
        message: 'User registered successfully',
        data: {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id)
        }
    };
};
exports.createBusinessProfile = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const { name, businessAddress, metaAccessToken, metaAppId, metaBusinessId } = req.body;

    if (!name || !metaAccessToken || !metaBusinessId || !metaAppId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (name, metaAccessToken,metaAppId, metaBusinessId are required for business profile)."
        };
    }

    try {
        // Check if a business profile with this name or WABA ID already exists for this user/tenant
        const existingProfileByName = await BusinessProfile.findOne({ name, userId, tenantId });
        if (existingProfileByName) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: "A business profile with this name already exists for your account."
            };
        }
        const existingProfileByWabaId = await BusinessProfile.findOne({ metaBusinessId, userId, tenantId });
        if (existingProfileByWabaId) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: "A business profile with this WABA ID already exists for your account."
            };
        }

        const newProfile = await BusinessProfile.create({
            userId,
            tenantId,
            name,
            businessAddress,
            metaAccessToken,
            metaAppId,
            metaBusinessId
        });

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Business_profile_created_successfully,
            data: newProfile.toObject()
        };
    } catch (error) {
        console.error("Error creating business profile:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Update an existing business profile for the current user
// @access  Private (Authenticated User)
exports.updateBusinessProfile = async (req) => {
    const businessProfileId = req.params.id; // ID of the business profile to update
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const { name, businessAddress, metaAccessToken, metaAppId, metaBusinessId } = req.body;

    try {
        let businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });

        if (!businessProfile) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_not_found
            };
        }

        // Check for duplicate name or WABA ID if they are being changed
        if (name && name !== businessProfile.name) {
            const nameConflict = await BusinessProfile.findOne({ name, userId, tenantId, _id: { $ne: businessProfileId } });
            if (nameConflict) {
                return { status: statusCode.CONFLICT, success: false, message: "Another business profile with this name already exists." };
            }
        }
        if (metaBusinessId && metaBusinessId !== businessProfile.metaBusinessId) {
            const wabaIdConflict = await BusinessProfile.findOne({ metaBusinessId, userId, tenantId, _id: { $ne: businessProfileId } });
            if (wabaIdConflict) {
                return { status: statusCode.CONFLICT, success: false, message: "Another business profile with this WABA ID already exists." };
            }
        }

        businessProfile.name = name !== undefined ? name : businessProfile.name;
        businessProfile.businessAddress = businessAddress !== undefined ? businessAddress : businessProfile.businessAddress;
        businessProfile.metaAccessToken = metaAccessToken !== undefined ? metaAccessToken : businessProfile.metaAccessToken;
        businessProfile.metaAppId = metaAppId !== undefined ? metaAppId : businessProfile.metaAppId;
        businessProfile.metaBusinessId = metaBusinessId !== undefined ? metaBusinessId : businessProfile.metaBusinessId;
        await businessProfile.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Business_profile_updated_successfully,
            data: businessProfile.toObject()
        };
    } catch (error) {
        console.error("Error updating user's business profile:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};
exports.getAllBusinessProfilesForUser = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    try {
        const businessProfiles = await BusinessProfile.find({ userId, tenantId }).lean();
        if (businessProfiles.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.Business_profile_not_found, // Reusing message
                data: []
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: "Business profiles fetched successfully.",
            data: businessProfiles
        };
    } catch (error) {
        console.error("Error fetching user's business profiles:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Delete a business profile for the current user
// @access  Private (Authenticated User)
exports.deleteBusinessProfile = async (req) => {
    const businessProfileId = req.params.id;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    try {
        const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
        if (!businessProfile) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_not_found
            };
        }

        // Before deleting business profile, check if any projects are linked to it
        const linkedProjectsCount = await Project.countDocuments({ businessProfileId });
        if (linkedProjectsCount > 0) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: `Cannot delete business profile. It is linked to ${linkedProjectsCount} project(s). Please unlink or delete associated projects first.`
            };
        }

        // You might also want to check for linked Templates if you don't delete them cascade
        const linkedTemplatesCount = await Template.countDocuments({ businessProfileId });
        if (linkedTemplatesCount > 0) {
             return {
                status: statusCode.CONFLICT,
                success: false,
                message: `Cannot delete business profile. It is linked to ${linkedTemplatesCount} template(s). Please delete associated templates first.`
            };
        }


        await businessProfile.deleteOne();

        return {
            status: statusCode.OK,
            success: true,
            message: "Business profile deleted successfully."
        };
    } catch (error) {
        console.error("Error deleting business profile:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Business Profile ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Auth user & get token (login) for the current tenant
// @route   POST /api/users/login
// @access  Public
const authUser = async (req) => {
  const { email, password } = req.body;
  const tenantId = req.tenant?._id;

  if (!tenantId) {
    return {
      success: false,
      message: 'Tenant not found in request',
      status: 400
    };
  }

  const user = await User.findOne({ email, tenantId });
console.log(`[Auth] Attempting login for user: ${email} in tenant: ${tenantId}`);
  if (user && await user.matchPassword(password)) {
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: generateToken(user._id)
      }
    };
  }

  return {
    success: false,
    message: 'Invalid email or password',
    status: 401
  };
};




// @desc    Get user profile for the current tenant
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    // req.user is already populated by protect middleware
    // req.tenant._id ensures data is for the correct tenant
    if (req.user && req.user.tenantId.toString() === req.tenant._id.toString()) {
        res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update user profile for the current tenant
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user && user.tenantId.toString() === req.tenant._id.toString()) {
            user.username = username || user.username;
            user.email = email || user.email;
            if (password) {
                user.password = password; // pre-save hook will hash it
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                token: generateToken(updatedUser._id)
            });
        } else {
            res.status(404).json({ message: 'User not found or not authorized for this tenant' });
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all users for the current tenant (Tenant Admin only)
// @route   GET /api/users
// @access  Private (Tenant Admin)
const getAllUsersForTenant = async (req, res) => {
    const tenantId = req.tenant._id; // Get tenantId from resolved tenant middleware

    try {
        // Ensure only users belonging to the current tenant are fetched
        const users = await User.find({ tenantId }).select('-password'); // Exclude passwords

        // Filter out super admin if necessary (though they are already filtered by tenantId if they exist)
        // Also, exclude the 'super_admin' role from this view if you decide to have a global super admin user in User model
        const filteredUsers = users.filter(user => user.role !== 'super_admin');

        res.json(filteredUsers);
    } catch (error) {
        console.error('Error fetching users for tenant:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Register a new user by a tenant admin for their tenant
// @route   POST /api/users/admin-register
// @access  Private (Tenant Admin)
const registerUserByAdmin = async (req, res) => {
    const { username, email, password, role } = req.body;
    const tenantId = req.tenant._id; // Get tenantId from resolved tenant middleware

    try {
        // Ensure the tenant admin is creating a user for their own tenant
        if (req.user.tenantId.toString() !== tenantId.toString()) {
            return res.status(403).json({ message: 'Unauthorized: Cannot create users for other tenants.' });
        }

        const userExists = await User.findOne({ email, tenantId });
        if (userExists) {
            return res.status(400).json({ message: 'User with that email already exists for this tenant.' });
        }

        // Tenant admin can create 'user' role. If 'tenant_admin' role is passed, validate carefully.
        // For simplicity, let's assume admin can only create 'user' roles here.
        // Or you can allow them to create 'tenant_admin' but with more strict checks.
        const userRole = role === 'tenant_admin' ? 'tenant_admin' : 'user';

        const user = await User.create({
            tenantId,
            username,
            email,
            password,
            role: userRole
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            });
        } else {
            res.status(400).json({ message: 'Invalid user data provided by admin' });
        }
    } catch (error) {
        console.error('Error during user registration by admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Add these exports at the bottom of your file
module.exports = {
    registerUser,
    authUser,
    getUserProfile,
    updateUserProfile,
    getAllUsersForTenant,
    registerUserByAdmin,
    createBusinessProfile: async (req, res) => {
        const result = await this.createBusinessProfile(req);
        res.status(result.status).json({
            success: result.success,
            message: result.message,
            data: result.data
        });
    },
    getAllBusinessProfilesForUser: async (req, res) => {
        const result = await this.getAllBusinessProfilesForUser(req);
        res.status(result.status).json({
            success: result.success,
            message: result.message,
            data: result.data
        });
    },
    updateBusinessProfile: async (req, res) => {
        const result = await this.updateBusinessProfile(req);
        res.status(result.status).json({
            success: result.success,
            message: result.message,
            data: result.data
        });
    }
};
