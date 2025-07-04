const express = require('express');
const { protect } = require('../middleware/auth');
const responseHandler = require('../middleware/responseHandler');
const teamMemberController = require('../controllers/teamMemberController');

const router = express.Router({ mergeParams: true }); // mergeParams is crucial for nested routes

// All team member routes will be prefixed with /api/projects/:projectId/team-member

// Create a new team member for a specific project
router.post("/", protect, responseHandler(teamMemberController.createController));

// Get all team members for a project
router.get("/", protect, responseHandler(teamMemberController.getAllController));

// Get a specific team member by ID
router.get("/:id", protect, responseHandler(teamMemberController.getByIdController));

// Update a team member by ID
router.put("/:id", protect, responseHandler(teamMemberController.updateController));

// Delete a team member by ID
router.delete("/:id", protect, responseHandler(teamMemberController.deleteController));

module.exports = router;
