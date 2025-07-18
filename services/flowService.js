// // server/services/flowService.js
// const Flow = require('../models/Flow');
// const { statusCode, resMessage } = require('../config/constants');
// const Project = require("../models/Project");

// exports.create = async (req) => {
//     try {
//         const { nodes, edges } = req.body; 
        
//         const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
//         console.log("checkProject", req.params.projectId);
//         if (!checkProject) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.Project_already_exists,
//                 statusCode: statusCode.NOT_FOUND,
//             }
//         }

//         if (!Array.isArray(nodes) || nodes.length === 0) {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: resMessage.nodes_array_is_required,
//                 statusCode: statusCode.BAD_REQUEST
//             }
//         }

//         if (!Array.isArray(edges)) {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: resMessage.edges_array_is_required,
//                 statusCode: statusCode.BAD_REQUEST
//             }
//         }

//         const entryNode = nodes.find(n => n.id === 'node_0' && n.data?.message);
//         console.log("entryNode", entryNode);
//         const entryPoint = entryNode?.data?.message?.toLowerCase();

//         if (!entryPoint) {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: resMessage.No_valid_entry_point,
//                 statusCode: statusCode.BAD_REQUEST
//             }
//         }

//         const savedFlow = await Flow.create({
//             projectId: req.params.projectId,
//             userId: req.auth._id,
//             entryPoint,
//             nodes,
//             edges
//         });

//         return {
//             status: statusCode.SUCCESS,
//             success: true,
//             message: resMessage.Flow_created_successfully,
//             data: savedFlow,
//             statusCode: statusCode.SUCCESS
//         }
//     } catch (error) {
//         return {
//             success: false,
//             message,
//             statusCode: statusCode.INTERNAL_SERVER_ERROR,
//         };
//     }
// }

// /**
//  * @desc    Get all flows for a specific project, user, and tenant.
//  * @param {Object} queryParams - Query parameters.
//  * @param {string} queryParams.projectId - ID of the project.
//  * @param {string} queryParams.userId - ID of the user.
//  * @param {string} queryParams.tenantId - ID of the tenant.
//  * @returns {Object} Success status and array of flows.
//  */
// exports.getFlows = async ({ projectId, userId, tenantId }) => {
//     if (!projectId || !userId || !tenantId) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (projectId, userId, tenantId are required)."
//         };
//     }

//     try {
//         const flows = await Flow.find({ projectId, userId, tenantId }).lean();
//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Flows_fetched_successfully,
//             data: flows,
//         };
//     } catch (error) {
//         console.error("Error fetching flows:", error);
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: error.message || resMessage.Server_error,
//         };
//     }
// };

// /**
//  * @desc    Get a single flow by ID.
//  * @param {Object} params - Parameters for fetching flow.
//  * @param {string} params.flowId - ID of the flow.
//  * @param {string} params.projectId - ID of the project.
//  * @param {string} params.userId - ID of the user.
//  * @param {string} params.tenantId - ID of the tenant.
//  * @returns {Object} Success status and the flow data.
//  */
// exports.getFlowById = async ({ flowId, projectId, userId, tenantId }) => {
//     if (!flowId || !projectId || !userId || !tenantId) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
//         };
//     }

//     try {
//         const flow = await Flow.findOne({ _id: flowId, projectId, userId, tenantId }).lean();
//         if (!flow) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.No_data_found + " (Flow not found or unauthorized)."
//             };
//         }
//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Flow_fetched_successfully,
//             data: flow,
//         };
//     } catch (error) {
//         console.error("Error fetching flow by ID:", error);
//         if (error.name === "CastError") {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: "Invalid Flow ID format.",
//             };
//         }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: error.message || resMessage.Server_error,
//         };
//     }
// };

// /**
//  * @desc    Update an existing conversational flow.
//  * @param {Object} params - Parameters for updating flow.
//  * @param {string} params.flowId - ID of the flow to update.
//  * @param {string} params.projectId - ID of the project.
//  * @param {string} params.userId - ID of the user.
//  * @param {string} params.tenantId - ID of the tenant.
//  * @param {Object} updateData - Data to update the flow with.
//  * @returns {Object} Success status and the updated flow.
//  */
// exports.updateFlow = async ({ flowId, projectId, userId, tenantId }, updateData) => {
//     if (!flowId || !projectId || !userId || !tenantId || !updateData) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId, and updateData are required)."
//         };
//     }

//     try {
//         // Check for name conflict if name is being updated
//         if (updateData.name) {
//             const existingFlow = await Flow.findOne({
//                 name: updateData.name,
//                 projectId,
//                 userId,
//                 tenantId,
//                 _id: { $ne: flowId } // Exclude the current flow being updated
//             });
//             if (existingFlow) {
//                 return {
//                     status: statusCode.CONFLICT,
//                     success: false,
//                     message: resMessage.Flow_name_exists,
//                 };
//             }
//         }

//         const updatedFlow = await Flow.findOneAndUpdate(
//             { _id: flowId, projectId, userId, tenantId },
//             updateData,
//             { new: true, runValidators: true } // Return the updated document and run schema validators
//         ).lean();

//         if (!updatedFlow) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.No_data_found + " (Flow not found or unauthorized)."
//             };
//         }

//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Flow_updated_successfully,
//             data: updatedFlow,
//         };
//     } catch (error) {
//         console.error("Error updating flow:", error);
//         if (error.name === "CastError") {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: "Invalid Flow ID format.",
//             };
//         }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: error.message || resMessage.Server_error,
//         };
//     }
// };

// /**
//  * @desc    Delete a conversational flow.
//  * @param {Object} params - Parameters for deleting flow.
//  * @param {string} params.flowId - ID of the flow to delete.
//  * @param {string} params.projectId - ID of the project.
//  * @param {string} params.userId - ID of the user.
//  * @param {string} params.tenantId - ID of the tenant.
//  * @returns {Object} Success status.
//  */
// exports.deleteFlow = async ({ flowId, projectId, userId, tenantId }) => {
//     if (!flowId || !projectId || !userId || !tenantId) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
//         };
//     }

//     try {
//         const deletedFlow = await Flow.findOneAndDelete({ _id: flowId, projectId, userId, tenantId });

//         if (!deletedFlow) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.No_data_found + " (Flow not found or unauthorized)."
//             };
//         }

//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Flow_deleted_successfully,
//         };
//     } catch (error) {
//         console.error("Error deleting flow:", error);
//         if (error.name === "CastError") {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: "Invalid Flow ID format.",
//             };
//         }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: error.message || resMessage.Server_error,
//         };
//     }
// };




// server/services/flowService.js
const Flow = require('../models/Flow'); // Ensure this points to the correct Flow model
const Project = require('../models/Project'); // Ensure this points to the correct Project model
const { statusCode, resMessage } = require('../config/constants');

/**
 * @desc    Create a new conversational flow.
 * @param {Object} flowData - Data for the new flow.
 * @param {string} flowData.name - Name of the flow.
 * @param {string} flowData.triggerKeyword - Keyword that triggers the flow.
 * @param {Array} flowData.nodes - Array of node objects.
 * @param {Array} flowData.edges - Array of edge objects.
 * @param {string} flowData.projectId - ID of the project.
 * @param {string} flowData.userId - ID of the user creating the flow.
 * @param {string} flowData.tenantId - ID of the tenant.
 * @param {string} [flowData.description] - Description of the flow.
 * @param {string} [flowData.status] - Status of the flow (draft, active, archived).
 * @param {string} [flowData.whatsappPhoneNumberId] - Associated WhatsApp phone number ID.
 * @returns {Object} Success status and the created flow.
 */
exports.createFlow = async ({ name, triggerKeyword, nodes, edges, projectId, userId, tenantId, description, status }) => {
    try {
        if (!name || !projectId || !userId || !tenantId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Missing_required_fields + " (name, projectId, userId, tenantId are required)."
            };
        }

        // Validate nodes and edges
        if (!Array.isArray(nodes) || nodes.length === 0) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.nodes_array_is_required,
            };
        }

        if (!Array.isArray(edges)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.edges_array_is_required,
            };
        }

        // Check if project exists and belongs to user/tenant
        const checkProject = await Project.findOne({ _id: projectId, userId, tenantId });
        if (!checkProject) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Project not found or unauthorized).",
            };
        }

        // Check for duplicate flow name within the project/user/tenant scope
        const existingFlow = await Flow.findOne({ name, projectId, userId, tenantId });
        if (existingFlow) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Flow_name_exists,
            };
        }

        // The triggerKeyword is now a direct field, not derived from a specific node
        if (!triggerKeyword || triggerKeyword.trim() === '') {
             return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.No_valid_entry_point, // Renamed for clarity
            };
        }


        const savedFlow = await Flow.create({
            projectId,
            userId,
            tenantId,
            name,
            triggerKeyword: triggerKeyword.trim(), // Use the provided triggerKeyword
            description,
            nodes,
            edges,
            status: status || 'draft',
            // whatsappPhoneNumberId,
        });

        return {
            status: statusCode.CREATED, // Changed to CREATED (201) for new resource
            success: true,
            message: resMessage.Flow_created_successfully,
            data: savedFlow,
        };
    } catch (error) {
        console.error("Error creating flow:", error);
        return {
            success: false,
            message: error.message || resMessage.Server_error, // Ensure error.message is returned
            status: statusCode.INTERNAL_SERVER_ERROR,
        };
    }
};

/**
 * @desc    Get all flows for a specific project, user, and tenant.
 * @param {Object} queryParams - Query parameters.
 * @param {string} queryParams.projectId - ID of the project.
 * @param {string} queryParams.userId - ID of the user.
 * @param {string} queryParams.tenantId - ID of the tenant.
 * @returns {Object} Success status and array of flows.
 */
exports.getFlows = async ({ projectId, userId, tenantId }) => {
    if (!projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (projectId, userId, tenantId are required)."
        };
    }

    try {
        const flows = await Flow.find({ projectId, userId, tenantId }).lean();
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flows_fetched_successfully,
            data: flows,
        };
    } catch (error) {
        console.error("Error fetching flows:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};

/**
 * @desc    Get a single flow by ID.
 * @param {Object} params - Parameters for fetching flow.
 * @param {string} params.flowId - ID of the flow.
 * @param {string} params.projectId - ID of the project.
 * @param {string} params.userId - ID of the user.
 * @param {string} params.tenantId - ID of the tenant.
 * @returns {Object} Success status and the flow data.
 */
exports.getFlowById = async ({ flowId, projectId, userId, tenantId }) => {
    if (!flowId || !projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
        };
    }

    try {
        const flow = await Flow.findOne({ _id: flowId, projectId, userId, tenantId }).lean();
        if (!flow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Flow not found or unauthorized)."
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_fetched_successfully,
            data: flow,
        };
    } catch (error) {
        console.error("Error fetching flow by ID:", error);
        if (error.name === "CastError") {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid Flow ID format.",
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};

/**
 * @desc    Update an existing conversational flow.
 * @param {Object} params - Parameters for updating flow.
 * @param {string} params.flowId - ID of the flow to update.
 * @param {string} params.projectId - ID of the project.
 * @param {string} params.userId - ID of the user.
 * @param {string} params.tenantId - ID of the tenant.
 * @param {Object} updateData - Data to update the flow with.
 * @returns {Object} Success status and the updated flow.
 */
exports.updateFlow = async ({ flowId, projectId, userId, tenantId }, updateData) => {
    if (!flowId || !projectId || !userId || !tenantId || !updateData) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId, and updateData are required)."
        };
    }

    try {
        // Check for name conflict if name is being updated
        if (updateData.name) {
            const existingFlow = await Flow.findOne({
                name: updateData.name,
                projectId,
                userId,
                tenantId,
                _id: { $ne: flowId } // Exclude the current flow being updated
            });
            if (existingFlow) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Flow_name_exists,
                };
            }
        }

        // Validate triggerKeyword if it's being updated
        if (updateData.triggerKeyword !== undefined && updateData.triggerKeyword.trim() === '') {
             return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.No_valid_entry_point,
            };
        }


        const updatedFlow = await Flow.findOneAndUpdate(
            { _id: flowId, projectId, userId, tenantId },
            updateData,
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).lean();

        if (!updatedFlow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Flow not found or unauthorized)."
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_updated_successfully,
            data: updatedFlow,
        };
    } catch (error) {
        console.error("Error updating flow:", error);
        if (error.name === "CastError") {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid Flow ID format.",
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};

/**
 * @desc    Delete a conversational flow.
 * @param {Object} params - Parameters for deleting flow.
 * @param {string} params.flowId - ID of the flow to delete.
 * @param {string} params.projectId - ID of the project.
 * @param {string} params.userId - ID of the user.
 * @param {string} params.tenantId - ID of the tenant.
 * @returns {Object} Success status.
 */
exports.deleteFlow = async ({ flowId, projectId, userId, tenantId }) => {
    if (!flowId || !projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
        };
    }

    try {
        const deletedFlow = await Flow.findOneAndDelete({ _id: flowId, projectId, userId, tenantId });

        if (!deletedFlow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Flow not found or unauthorized)."
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_deleted_successfully,
        };
    } catch (error) {
        console.error("Error deleting flow:", error);
        if (error.name === "CastError") {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid Flow ID format.",
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};
