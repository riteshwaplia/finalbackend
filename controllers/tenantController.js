const Tenant = require('../models/Tenant');
const User = require('../models/User');
const generateToken = require('../utils/generateToken'); // Utility to generate JWT
const { statusCode, resMessage } = require('../config/constants'); // Import constants

// @desc    Create a new tenant (Super Admin only)
// @route   POST /api/tenants
// @access  Private (Super Admin)
const createTenant = async (req, res) => {
    const { name, domain, websiteName, adminUsername, adminEmail, adminPassword, metaApi } = req.body; // Added metaApi

    // Check if the current user's tenant is the super admin tenant
    if (!req.user || !req.tenant.isSuperAdmin) {
        return res.status(statusCode.FORBIDDEN).json({ message: 'Only the super admin can create new tenants.' });
    }

    try {
        const tenantExists = await Tenant.findOne({ domain });
        if (tenantExists) {
            return res.status(statusCode.CONFLICT).json({ message: 'Tenant with this domain already exists' });
        }

        const tenant = await Tenant.create({
            name,
            domain,
            websiteName,
            metaApi: metaApi || {}, // Assign provided metaApi or an empty object
        });

        const adminUser = await User.create({
            tenantId: tenant._id,
            username: adminUsername,
            email: adminEmail,
            password: adminPassword,
            role: 'tenant_admin'
        });

        res.status(statusCode.CREATED).json({
            _id: tenant._id,
            name: tenant.name,
            domain: tenant.domain,
            websiteName: tenant.websiteName,
            isActive: tenant.isActive,
            metaApi: tenant.metaApi, // Include metaApi in response
            message: 'Tenant and admin user created successfully',
            adminUser: {
                id: adminUser._id,
                username: adminUser.username,
                email: adminUser.email,
                role: adminUser.role
            }
        });
    } catch (error) {
        console.error('Error creating tenant:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: resMessage.Server_error, error: error.message });
    }
};

// @desc    Get all tenants (Super Admin only)
// @route   GET /api/tenants
// @access  Private (Super Admin)
const getAllTenants = async (req, res) => {
    if (!req.user || !req.tenant.isSuperAdmin) {
        return res.status(statusCode.FORBIDDEN).json({ message: 'Only the super admin can view all tenants.' });
    }
    try {
        const tenants = await Tenant.find({});
        res.json(tenants);
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: resMessage.Server_error, error: error.message });
    }
};

// @desc    Update tenant active status (Super Admin only)
// @route   PUT /api/tenants/:id/status
// @access  Private (Super Admin)
const updateTenantStatus = async (req, res) => {
    if (!req.user || !req.tenant.isSuperAdmin) {
        return res.status(statusCode.FORBIDDEN).json({ message: 'Only the super admin can change tenant status.' });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    try {
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(statusCode.NOT_FOUND).json({ message: resMessage.No_data_found });
        }

        tenant.isActive = isActive;
        await tenant.save();
        res.json({ message: 'Tenant status updated', tenant });
    } catch (error) {
        console.error('Error updating tenant status:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: resMessage.Server_error, error: error.message });
    }
};

// @desc    Update tenant settings by tenant admin
// @route   PUT /api/tenants/:id
// @access  Private (Tenant Admin)
const updateTenantSettings = async (req, res) => {
    const { id } = req.params;
    const { websiteName, faviconUrl, metaApi } = req.body; // Added metaApi

    try {
        // Ensure the logged-in user is an admin of this specific tenant
        // And ensure they are not trying to update another tenant's settings
        if (
    !req.user ||
    !(req.user.role === 'tenant_admin' || req.user.role === 'super_admin') ||
    req.user.tenantId.toString() !== id
) {
            return res.status(statusCode.FORBIDDEN).json({ message: 'Not authorized to update these tenant settings.' });
        }

        const tenant = await Tenant.findById(id);

        if (!tenant) {
            return res.status(statusCode.NOT_FOUND).json({ message: resMessage.No_data_found });
        }

        tenant.websiteName = websiteName || tenant.websiteName;
        tenant.faviconUrl = faviconUrl || tenant.faviconUrl;

        // NEW: Update metaApi fields if provided
        if (metaApi) {
            tenant.metaApi.wabaId = metaApi.wabaId !== undefined ? metaApi.wabaId : tenant.metaApi.wabaId;
            tenant.metaApi.accessToken = metaApi.accessToken !== undefined ? metaApi.accessToken : tenant.metaApi.accessToken;
            tenant.metaApi.appId = metaApi.appId !== undefined ? metaApi.appId : tenant.metaApi.appId;
            tenant.metaApi.facebookUrl = metaApi.facebookUrl !== undefined ? metaApi.facebookUrl : tenant.metaApi.facebookUrl;
            tenant.metaApi.graphVersion = metaApi.graphVersion !== undefined ? metaApi.graphVersion : tenant.metaApi.graphVersion;
        }

        const updatedTenant = await tenant.save();

        res.json({
            message: 'Tenant settings updated successfully',
            tenant: {
                _id: updatedTenant._id,
                name: updatedTenant.name,
                domain: updatedTenant.domain,
                websiteName: updatedTenant.websiteName,
                faviconUrl: updatedTenant.faviconUrl,
                isActive: updatedTenant.isActive,
                metaApi: updatedTenant.metaApi // Include updated metaApi in response
            }
        });

    } catch (error) {
        console.error('Error updating tenant settings:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: resMessage.Server_error, error: error.message });
    }
};


module.exports = { createTenant, getAllTenants, updateTenantStatus, updateTenantSettings };
