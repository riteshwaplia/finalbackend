// server/routes/flowRoutes.js
const express = require('express');
const router = express.Router();
const flowController = require('../controllers/flowController');
const { protect } = require('../middleware/auth'); // Our existing auth middleware
const responseHandler = require('../middleware/responseHandler'); // Assuming your response handler

// All flow routes are nested under /api/projects/:projectId/flows

// Create a new flow for a specific project
router.post('/', protect, responseHandler(flowController.createController));

// Get all flows for a specific project
// router.get('/', protect, responseHandler(flowController.getFlowsController));

// // Get a single flow by ID for a specific project
// router.get('/:flowId', protect, responseHandler(flowController.getFlowByIdController));

// // Update a flow for a specific project
// router.put('/:flowId', protect, responseHandler(flowController.updateFlowController));

// // Delete a flow for a specific project
// router.delete('/:flowId', protect, responseHandler(flowController.deleteFlowController));

module.exports = router;
