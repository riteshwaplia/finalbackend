// // server/services/flowService.js
const Flow = require('../models/Flow');
const { statusCode, resMessage } = require('../config/constants');
const Project = require("../models/project");

exports.create = async (req) => {
    try {
        const { name, nodes, edges } = req.body;
        
        const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
        if (!checkProject) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            }
        }

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

        const entryNode = nodes.find(n => n.id === 'node_0' && n.data?.message);
        const entryPoint = entryNode?.data?.message?.toLowerCase();
        console.log("Entry Point:", entryPoint);

        if (!entryPoint) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Project not found or unauthorized).",
            };
        }

        const existingFlow = await Flow.findOne({ name, projectId, userId, tenantId });
        if (existingFlow) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Flow_name_exists,
            };
        }

        if (!triggerKeyword || triggerKeyword.trim() === '') {
             return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.No_valid_entry_point,
            };
        }


        const savedFlow = await Flow.create({
            projectId: req.params.projectId,
            userId: req.user._id,
            tenantId: req.tenant._id,
            entryPoint,
            nodes,
            edges,
            name
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
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR,
        };
    }
};

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

// exports.updateFlow = async ({ flowId, projectId, userId, tenantId }, updateData) => {
//     if (!flowId || !projectId || !userId || !tenantId || !updateData) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId, and updateData are required)."
//         };
//     }

//     try {
//         if (updateData.name) {
//             const existingFlow = await Flow.findOne({
//                 name: updateData.name,
//                 projectId,
//                 userId,
//                 tenantId,
//                 _id: { $ne: flowId }
//             });
//             if (existingFlow) {
//                 return {
//                     status: statusCode.CONFLICT,
//                     success: false,
//                     message: resMessage.Flow_name_exists,
//                 };
//             }
//         }

//         // Validate triggerKeyword if it's being updated
//         if (updateData.triggerKeyword !== undefined && updateData.triggerKeyword.trim() === '') {
//              return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: resMessage.No_valid_entry_point,
//             };
//         }


//         const updatedFlow = await Flow.findOneAndUpdate(
//             { _id: flowId, projectId, userId, tenantId },
//             updateData,
//             { new: true, runValidators: true } 
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
