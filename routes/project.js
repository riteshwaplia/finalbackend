// const { protect, authorizeRoles } = require('../middleware/auth'); // Only `protect` is needed for user projects
// const projectController = require('../controllers/projectController');
// const responseHandler = require('../middleware/responseHandler');


// // All project routes require authentication and will automatically use tenantId from req.tenant
// router.route('/')
//     .post(protect,authorizeRoles('user'), responseHandler(projectController.createProject)) // Create a new project
//     .get(protect,authorizeRoles('user'), responseHandler(projectController.getAllProjects));   // List all projects for the current user
// router.get("/:id/dashboard", protect,authorizeRoles('user') ,responseHandler(projectController.getProjectById));

// // router.route('/:id')
// //     .get(protect, projectController.details)  // Get project details
// //     .put(protect, projectController.update)   // Update a project
// //     .delete(protect, projectController.delete); // Delete a project

// module.exports = router;



const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, authorizeRoles } = require('../middleware/auth'); // Only `protect` is needed for user projects
const responseHandler = require('../middleware/responseHandler');

// Project-specific routes (nested under /api/projects/:projectId)
// Note: Some routes might still use /api/projects/ for listing all projects,
// while others use /api/projects/:projectId for specific project actions.

// Create a new project (POST /api/projects)
router.post('/', protect, responseHandler(projectController.createProjectController));

// Get all projects for the authenticated user (GET /api/projects)
router.get('/', protect, responseHandler(projectController.getAllProjectsController));

// Get a single project by ID (GET /api/projects/:id)
router.get('/:id/dashboard', protect, responseHandler(projectController.getProjectByIdController));

// Update a project by ID (PUT /api/projects/:projectId)
router.put('/:projectId', protect, responseHandler(projectController.updateProjectController));

// Delete a project by ID (DELETE /api/projects/:projectId)
router.delete('/:projectId', protect, responseHandler(projectController.deleteProjectController));

// NEW: Update WhatsApp Business Profile details for a project's phone number
// PUT /api/projects/:projectId/whatsapp-business-profile
router.put('/:projectId/whatsapp-business-profile', protect, responseHandler(projectController.updateWhatsappBusinessProfileController));

module.exports = router;
