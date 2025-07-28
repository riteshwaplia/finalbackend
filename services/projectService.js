const Project = require('../models/project'); // Corrected import from 'project' to 'Project'
const BusinessProfile = require('../models/BusinessProfile');
const { statusCode, resMessage } = require('../config/constants');
const axios = require('axios'); // Import axios for Meta API calls

// @desc    Create a new project
// @access  Private (Tenant Admin or regular User)
exports.createProject = async (req) => {
    const {
        name, description, businessProfileId, isWhatsappVerified, assistantName,
        metaPhoneNumberID, whatsappNumber, activePlan, planDuration,
        // NEW WhatsApp Business Profile fields
        about, address, email, websites, vertical, profilePictureUrl
    } = req.body;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    if (!name || !businessProfileId || !metaPhoneNumberID || !whatsappNumber) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (name, businessProfileId, metaPhoneNumberID, and whatsappNumber are required)."
        };
    }

    try {
        const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
        if (!businessProfile) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: "Selected Business Profile not found or does not belong to your account."
            };
        }

        const projectExists = await Project.findOne({ name, tenantId, userId, businessProfileId });
        if (projectExists) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Project_already_exists
            };
        }

        const project = await Project.create({
            name,
            description,
            tenantId,
            userId,
            businessProfileId,
            isWhatsappVerified: isWhatsappVerified !== undefined ? isWhatsappVerified : false,
            assistantName,
            metaPhoneNumberID,
            whatsappNumber,
            activePlan,
            planDuration,
            // NEW WhatsApp Business Profile fields
            about,
            address,
            email,
            websites,
            vertical,
            profilePictureUrl
        });

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Project_created_successfully,
            data: project
        };
    } catch (error) {
        console.error("Error creating project:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Get all projects for the authenticated user within their tenant
// @access  Private
exports.getAllProjects = async (req) => {
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        // Populate businessProfileId to get its name and metaBusinessId
        const projects = await Project.find({ tenantId, userId }).populate('businessProfileId', 'name metaBusinessId');
        if (projects.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.No_data_found,
                data: []
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Projects_fetched_successfully, // Corrected message constant
            data: projects
        };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Get a single project by ID
// @access  Private
exports.getProjectById = async (req) => {
    const projectId = req.params.id;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        // Populate businessProfileId to get its name and metaBusinessId
        const project = await Project.findOne({ _id: projectId, tenantId, userId }).populate('businessProfileId', 'name metaBusinessId');

        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_fetched_successfully, // Corrected message constant
            data: project
        };
    } catch (error) {
        console.error("Error fetching project by ID:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Update a project
// @access  Private
exports.updateProject = async (req) => {
    const projectId = req.params.projectId; // Assuming projectId from params
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const {
        name, description, businessProfileId, isWhatsappVerified, assistantName,
        metaPhoneNumberID, whatsappNumber, activePlan, planDuration,
        // NEW WhatsApp Business Profile fields
        about, address, email, websites, vertical, profilePictureUrl
    } = req.body;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId });
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        // Handle change of businessProfileId
        if (businessProfileId && businessProfileId.toString() !== project.businessProfileId.toString()) {
            const newBusinessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
            if (!newBusinessProfile) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: "New Business Profile not found or does not belong to your account."
                };
            }
            project.businessProfileId = businessProfileId;
        }

        // Handle name conflict if name is being updated
        if (name && name !== project.name) {
            const nameConflict = await Project.findOne({ name, tenantId, userId, businessProfileId: project.businessProfileId, _id: { $ne: projectId } });
            if (nameConflict) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Project_already_exists
                };
            }
        }

        // Update project fields
        project.name = name !== undefined ? name : project.name;
        project.description = description !== undefined ? description : project.description;
        project.isWhatsappVerified = isWhatsappVerified !== undefined ? isWhatsappVerified : project.isWhatsappVerified;
        project.assistantName = assistantName !== undefined ? assistantName : project.assistantName;
        project.metaPhoneNumberID = metaPhoneNumberID !== undefined ? metaPhoneNumberID : project.metaPhoneNumberID;
        project.whatsappNumber = whatsappNumber !== undefined ? whatsappNumber : project.whatsappNumber;
        project.activePlan = activePlan !== undefined ? activePlan : project.activePlan;
        project.planDuration = planDuration !== undefined ? planDuration : project.planDuration;

        // NEW: Update WhatsApp Business Profile fields
        project.about = about !== undefined ? about : project.about;
        project.address = address !== undefined ? address : project.address;
        project.email = email !== undefined ? email : project.email;
        project.websites = websites !== undefined ? websites : project.websites;
        project.vertical = vertical !== undefined ? vertical : project.vertical;
        project.profilePictureUrl = profilePictureUrl !== undefined ? profilePictureUrl : project.profilePictureUrl;

        await project.save();

        const updatedProject = await Project.findById(projectId).populate('businessProfileId', 'name metaBusinessId');

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_updated_successfully,
            data: updatedProject
        };
    } catch (error) {
        console.error("Error updating project:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Delete a project
// @access  Private
exports.deleteProject = async (req) => {
    const projectId = req.params.projectId; // Assuming projectId from params
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId });
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        await project.deleteOne();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_deleted_successfully
        };
    } catch (error) {
        console.error("Error deleting project:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

/**
 * @desc    Updates the WhatsApp Business Profile details on Meta's API for a specific phone number.
 * This function fetches necessary credentials from the linked BusinessProfile.
 * @param {Object} options - Options for updating the profile.
 * @param {string} options.projectId - The ID of the project whose phone number's profile is being updated.
 * @param {string} options.userId - The ID of the authenticated user.
 * @param {string} options.tenantId - The ID of the tenant.
 * @param {Object} profileData - The profile data to send to Meta (about, address, email, websites, vertical, profile_picture_handle).
 * @returns {Object} Success status and Meta API response data.
 */
exports.updateWhatsappBusinessProfileOnMeta = async ({ projectId, userId, tenantId, profileData }) => {
    if (!projectId || !userId || !tenantId || !profileData) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (projectId, userId, tenantId, and profileData are required)."
        };
    }

    try {
        const project = await Project.findOne({ _id: projectId, userId, tenantId }).populate('businessProfileId');
console.log("project to update WhatsApp Business Profile:", project);
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Project not found or unauthorized)."
            };
        }
        if (!project.metaPhoneNumberID) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Project_whatsapp_number_not_configured + " (Meta Phone Number ID is missing for this project)."
            };
        }
        if (!project.businessProfileId || !project.businessProfileId.metaAccessToken ) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Meta_API_credentials_not_configured + " for the linked Business Profile."
            };
        }
  const  facebookUrl = 'https://graph.facebook.com'
  const  graphVersion = 'v19.0'

  console.log("Using Meta API credentials:", {
            accessToken: project.businessProfileId.metaAccessToken,
            facebookUrl,
            graphVersion
        });
        const { metaPhoneNumberID } = project;
        const { metaAccessToken } = project.businessProfileId;
console.log("Meta API credentials:", { metaAccessToken, facebookUrl, graphVersion });
        const url = `${facebookUrl}/${graphVersion}/${metaPhoneNumberID}/whatsapp_business_profile`;
console.log("Meta API URL:", url);
        // Construct the payload for Meta API
        const metaPayload = {
            messaging_product: "whatsapp",
            ...profileData
        };

        console.log(`[WhatsApp Business Profile Update] Sending payload to Meta: ${JSON.stringify(metaPayload)}`);

        const response = await axios.post(url, metaPayload, {
            headers: {
                'Authorization': `Bearer ${metaAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Meta API returns { success: true } on success for this endpoint
        if (response.data.success) {
            // Optionally, update the Project model with the new profile data if Meta confirms success
            // This is important to keep your DB in sync with Meta.
            // Note: Meta's response for this endpoint is just { success: true }, it doesn't return the full profile.
            // So, we update based on what we sent.
            Object.assign(project, profileData); // Apply the updates to the project document
            await project.save(); // Save the updated project document

            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.WhatsApp_Business_Profile_updated_successfully,
                data: response.data
            };
        } else {
            return {
                status: statusCode.INTERNAL_SERVER_ERROR,
                success: false,
                message: "Meta API reported failure.",
                data: response.data
            };
        }
    } catch (error) {
        console.error("Error updating WhatsApp Business Profile on Meta:", error.response?.data || error.message);
        return {
            status: error.response?.status || statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: `Failed to update WhatsApp Business Profile: ${error.response?.data?.error?.message || error.message}`,
            metaError: error.response?.data?.error || null,
        };
    }
};
