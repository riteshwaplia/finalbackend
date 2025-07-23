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
const { protect, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, authorizeRoles } = require('../middleware/auth'); // Only `protect` is needed for user projects
const responseHandler = require('../middleware/responseHandler');
const validate = require('../middleware/validate'); 

const {
  validateCreateProject,
  validateUpdateProject,
  validateProjectId
} = require('../validations/projectValidation');

// Project-specific routes (nested under /api/projects/:projectId)
// Note: Some routes might still use /api/projects/ for listing all projects,
// while others use /api/projects/:projectId for specific project actions.

// ===== Routes =====

// Create & Get All Projects
router.route('/')
  .post(
    protect,
    authorizeRoles('user'),
    validate(validateCreateProject, 'body'),
    responseHandler(projectController.createProject)
  )
  .get(
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.getAllProjects)
  );

// Get Project by ID (dashboard view)
router.get(
  '/:id/dashboard',
  protect,
  authorizeRoles('user'),
  validate(validateProjectId, 'params'),
  responseHandler(projectController.getProjectById)
);

// Update & Delete Project by ID
router
  .put("/:id",
    protect,
    authorizeRoles('user'),
    validate(validateProjectId, 'params'),
    validate(validateUpdateProject, 'body'),
    responseHandler(projectController.updateProject)
  );
  // .delete(
  //   protect,
  //   authorizeRoles('user'),
  //   validate(validateProjectId, 'params'),
  //   responseHandler(projectController.deleteProject)
  // );


  router.delete(
    '/:id/delete',
    protect,
    authorizeRoles('user'),
    validate(validateProjectId, 'params'),

    responseHandler(projectController.deleteProject)
  );


// Update a project by ID (PUT /api/projects/:projectId)
router.put('/:projectId', protect, responseHandler(projectController.updateProjectController));

// Delete a project by ID (DELETE /api/projects/:projectId)
router.delete('/:projectId', protect, responseHandler(projectController.deleteProjectController));

// NEW: Update WhatsApp Business Profile details for a project's phone number
// PUT /api/projects/:projectId/whatsapp-business-profile
router.put('/:projectId/whatsapp-business-profile', protect, responseHandler(projectController.updateWhatsappBusinessProfileController));

module.exports = router;
