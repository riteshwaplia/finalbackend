// server/controllers/flowController.js
const flowService = require('../services/flowService');
const { statusCode, resMessage } = require('../config/constants');

/**
 * @desc    Create a new conversational flow.
 * @route   POST /api/projects/:projectId/flows
 * @access  Private (User/Team Member)
 */
exports.createFlowController = async (req) => {
    const { projectId } = req.params;
    const { name, triggerKeyword, description, nodes, edges, status, whatsappPhoneNumberId } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.createFlow({
        name,
        projectId,
        userId,
        tenantId,
        triggerKeyword,
        description,
        nodes,
        edges,
        status,
        whatsappPhoneNumberId,
    });
};

/**
 * @desc    Get all conversational flows for a specific project.
 * @route   GET /api/projects/:projectId/flows
 * @access  Private (User/Team Member)
 */
exports.getFlowsController = async (req) => {
    const { projectId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.getFlows({ projectId, userId, tenantId });
};

/**
 * @desc    Get a single conversational flow by ID.
 * @route   GET /api/projects/:projectId/flows/:flowId
 * @access  Private (User/Team Member)
 */
exports.getFlowByIdController = async (req) => {
    const { projectId, flowId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.getFlowById({ flowId, projectId, userId, tenantId });
};

/**
 * @desc    Update an existing conversational flow.
 * @route   PUT /api/projects/:projectId/flows/:flowId
 * @access  Private (User/Team Member)
 */
exports.updateFlowController = async (req) => {
    const { projectId, flowId } = req.params;
    const updateData = req.body; // Contains fields to update (name, nodes, edges, status, etc.)
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.updateFlow({ flowId, projectId, userId, tenantId }, updateData);
};

/**
 * @desc    Delete a conversational flow.
 * @route   DELETE /api/projects/:projectId/flows/:flowId
 * @access  Private (User/Team Member)
 */
exports.deleteFlowController = async (req) => {
    const { projectId, flowId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.deleteFlow({ flowId, projectId, userId, tenantId });
};
