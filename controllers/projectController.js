// const Project = require("../models/project");
// const { statusCode, resMessage } = require("../config/constants"); // Using new constants file

// // @desc    Create a new project for the current user within their tenant
// // @route   POST /api/projects
// // @access  Private (Authenticated User or Tenant Admin)
// exports.create = async (req, res) => {
//     try {
//         const userId = req.user._id; // Get user ID from authenticated user
//         const tenantId = req.tenant._id; // Get tenant ID from resolved tenant
//         const {
//             name,
//             isWhatsappVerified,
//             assistantName,
//             metaPhoneNumberID,
//             type,
//             activePlan,
//             providerType,
//             planDuration
//         } = req.body; // Destructure all new fields

//         // Ensure project name is unique for this user within this tenant
//         const existingData = await Project.findOne({ tenantId, userId, name });
//         if (existingData) {
//             return res.status(statusCode.CONFLICT).json({
//                 success: false,
//                 message: resMessage.Project_already_exists
//             });
//         }

//         const project = await Project.create({
//             tenantId,
//             userId,
//             name,
//             isWhatsappVerified,
//             assistantName,
//             metaPhoneNumberID,
//             type,
//             activePlan,
//             providerType,
//             planDuration
//         });

//         return res.status(statusCode.CREATED).json({
//             success: true,
//             message: resMessage.Project_created_successfully,
//             data: project // Return the created project data
//         });
//     } catch (error) {
//         console.error("Error creating project:", error);
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };

// // @desc    List all projects for the current user within their tenant
// // @route   GET /api/projects
// // @access  Private (Authenticated User or Tenant Admin)
// exports.list = async (req, res) => {
//     try {
//         const userId = req.user._id; // Get user ID from authenticated user
//         const tenantId = req.tenant._id; // Get tenant ID from resolved tenant

//         // Fetch projects specific to the authenticated user AND tenant
//         const existingData = await Project.find({ tenantId, userId }).sort({ createdAt: -1 });

//         if (existingData.length === 0) {
//             return res.status(statusCode.OK).json({
//                 success: true,
//                 data: [],
//                 message: resMessage.No_data_found // Changed message for empty array
//             });
//         }

//         const formattedData = existingData.map(project => {
//             const projectObj = project.toObject();
//             const date = new Date(projectObj.createdAt);
//             const options = { day: '2-digit', month: 'short', year: 'numeric' };
//             const formattedDate = new Intl.DateTimeFormat('en-GB', options).format(date);
//             projectObj.createdAt = `${formattedDate}`;
//             return projectObj;
//         });

//         return res.status(statusCode.OK).json({
//             success: true,
//             message: resMessage.Projects_fetch_successfully,
//             data: formattedData
//         });
//     } catch (error) {
//         console.error("Error listing projects:", error);
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };

// // @desc    Get details of a single project for the current user within their tenant
// // @route   GET /api/projects/:id
// // @access  Private (Authenticated User or Tenant Admin)
// exports.details = async (req, res) => {
//     try {
//         const { id } = req.params; // Project ID
//         const userId = req.user._id; // Authenticated user ID
//         const tenantId = req.tenant._id; // Resolved tenant ID

//         // Find project by its ID, and ensure it belongs to the authenticated user AND tenant
//         const existingData = await Project.findOne({ _id: id, userId, tenantId });

//         if (!existingData) {
//             return res.status(statusCode.NOT_FOUND).json({ // Changed to 404 Not Found
//                 success: false,
//                 message: resMessage.No_data_found
//             });
//         }
//         return res.status(statusCode.OK).json({
//             success: true,
//             message: resMessage.Projects_fetch_successfully,
//             data: existingData
//         });
//     } catch (error) {
//         console.error("Error fetching project details:", error);
//         // Handle CastError for invalid ObjectId if needed
//         if (error.name === 'CastError') {
//             return res.status(statusCode.BAD_REQUEST).json({
//                 success: false,
//                 message: "Invalid project ID."
//             });
//         }
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };

// // @desc    Update a project
// // @route   PUT /api/projects/:id
// // @access  Private (Authenticated User or Tenant Admin)
// exports.update = async (req, res) => {
//     try {
//         const { id } = req.params; // Project ID
//         const userId = req.user._id; // Authenticated user ID
//         const tenantId = req.tenant._id; // Resolved tenant ID
//         const {
//             name,
//             isWhatsappVerified,
//             assistantName,
//             metaPhoneNumberID,
//             type,
//             activePlan,
//             providerType,
//             planDuration
//         } = req.body; // Destructure all new fields

//         const project = await Project.findOne({ _id: id, userId, tenantId });

//         if (!project) {
//             return res.status(statusCode.NOT_FOUND).json({
//                 success: false,
//                 message: resMessage.No_data_found
//             });
//         }

//         // Check if new name conflicts with existing projects of the same user/tenant
//         if (name && name !== project.name) {
//             const nameConflict = await Project.findOne({ tenantId, userId, name });
//             if (nameConflict) {
//                 return res.status(statusCode.CONFLICT).json({
//                     success: false,
//                     message: resMessage.Project_already_exists
//                 });
//             }
//         }

//         // Update fields if provided
//         project.name = name || project.name;
//         project.isWhatsappVerified = isWhatsappVerified !== undefined ? isWhatsappVerified : project.isWhatsappVerified;
//         project.assistantName = assistantName !== undefined ? assistantName : project.assistantName;
//         project.metaPhoneNumberID = metaPhoneNumberID !== undefined ? metaPhoneNumberID : project.metaPhoneNumberID;
//         project.type = type !== undefined ? type : project.type;
//         project.activePlan = activePlan !== undefined ? activePlan : project.activePlan;
//         project.providerType = providerType !== undefined ? providerType : project.providerType;
//         project.planDuration = planDuration !== undefined ? planDuration : project.planDuration;

//         await project.save(); // pre-save hook will update `updatedAt`

//         return res.status(statusCode.OK).json({
//             success: true,
//             message: "Project updated successfully.",
//             data: project
//         });

//     } catch (error) {
//         console.error("Error updating project:", error);
//         if (error.name === 'CastError') {
//             return res.status(statusCode.BAD_REQUEST).json({
//                 success: false,
//                 message: "Invalid project ID."
//             });
//         }
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };

// // @desc    Delete a project
// // @route   DELETE /api/projects/:id
// // @access  Private (Authenticated User or Tenant Admin)
// exports.delete = async (req, res) => {
//     try {
//         const { id } = req.params; // Project ID
//         const userId = req.user._id; // Authenticated user ID
//         const tenantId = req.tenant._id; // Resolved tenant ID

//         const project = await Project.findOneAndDelete({ _id: id, userId, tenantId });

//         if (!project) {
//             return res.status(statusCode.NOT_FOUND).json({
//                 success: false,
//                 message: resMessage.No_data_found
//             });
//         }

//         return res.status(statusCode.OK).json({
//             success: true,
//             message: "Project deleted successfully."
//         });

//     } catch (error) {
//         console.error("Error deleting project:", error);
//         if (error.name === 'CastError') {
//             return res.status(statusCode.BAD_REQUEST).json({
//                 success: false,
//                 message: "Invalid project ID."
//             });
//         }
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };


// server/services/projectService.js
// server/services/projectService.js
// server/services/projectService.js
const Project = require('../models/Project');
const BusinessProfile = require('../models/BusinessProfile');
const { statusCode, resMessage } = require('../config/constants');

// @desc    Create a new project
// @access  Private (Tenant Admin or regular User)
exports.createProject = async (req) => {
    // Removed 'type' and 'providerType' from destructuring
    const { name, description, businessProfileId, isWhatsappVerified, assistantName, metaPhoneNumberID, whatsappNumber, activePlan, planDuration } = req.body;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
 console.log("businessProfileId:", businessProfileId, "metaPhoneNumberID:", metaPhoneNumberID, "whatsappNumber:", whatsappNumber);
    if (!name || !businessProfileId || !metaPhoneNumberID || !whatsappNumber) { // metaPhoneNumberID and whatsappNumber are now required for project creation
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
            metaPhoneNumberID, // NEW
            whatsappNumber,    // NEW
            activePlan,
            planDuration
        });
console.log("project created:", project);
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
console.log("getAllProjects called with tenantId:", tenantId, "userId:", userId);
    try {
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
            message: resMessage.Projects_fetch_successfully,
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
            message: resMessage.Projects_fetch_successfully,
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
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    // Removed 'type' and 'providerType' from destructuring
    const { name, description, businessProfileId, isWhatsappVerified, assistantName, metaPhoneNumberID, whatsappNumber, activePlan, planDuration } = req.body;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId });
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

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

        project.name = name || project.name;
        project.description = description !== undefined ? description : project.description;
        project.isWhatsappVerified = isWhatsappVerified !== undefined ? isWhatsappVerified : project.isWhatsappVerified;
        project.assistantName = assistantName !== undefined ? assistantName : project.assistantName;
        project.metaPhoneNumberID = metaPhoneNumberID !== undefined ? metaPhoneNumberID : project.metaPhoneNumberID; // NEW
        project.whatsappNumber = whatsappNumber !== undefined ? whatsappNumber : project.whatsappNumber;       // NEW
        project.activePlan = activePlan !== undefined ? activePlan : project.activePlan;
        project.planDuration = planDuration !== undefined ? planDuration : project.planDuration;

        await project.save();

        const updatedProject = await Project.findById(projectId).populate('businessProfileId', 'name metaBusinessId');

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_updated_successfully || "Project updated successfully.",
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
    const projectId = req.params.projectId;
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
            message: resMessage.Project_deleted_successfully || "Project deleted successfully."
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
