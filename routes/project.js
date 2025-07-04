const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth'); // Only `protect` is needed for user projects
const projectController = require('../controllers/projectController');
const responseHandler = require('../middleware/responseHandler');

const router = express.Router();

// All project routes require authentication and will automatically use tenantId from req.tenant
router.route('/')
    .post(protect,authorizeRoles('user'), responseHandler(projectController.createProject)) // Create a new project
    .get(protect,authorizeRoles('user'), responseHandler(projectController.getAllProjects));   // List all projects for the current user
router.get("/:id/dashboard", protect,authorizeRoles('user') ,responseHandler(projectController.getProjectById));

// router.route('/:id')
//     .get(protect, projectController.details)  // Get project details
//     .put(protect, projectController.update)   // Update a project
//     .delete(protect, projectController.delete); // Delete a project

module.exports = router;