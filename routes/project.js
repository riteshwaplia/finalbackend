const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const projectController = require('../controllers/projectController');
const responseHandler = require('../middleware/responseHandler');
const validate = require('../middleware/validate'); 
const { projectSchema } = require('../validations/projectValidator');

const {
  validateCreateProject,
  validateUpdateProject,
  validateProjectId
} = require('../validations/projectValidation');

const router = express.Router();

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

module.exports = router;
