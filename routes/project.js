const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { responseHandler } = require('../middleware/responseHandler');
const validate = require('../middleware/validate');
const { createProjectSchema } = require('../validations/projectValidation');

router.route('/')
  .post(
    protect,
    authorizeRoles('user'),
    validate(createProjectSchema),
    responseHandler(projectController.createProjectController)
  )
  .get(
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.getAllProjectsController)
  );

router.get('/:id/dashboard', protect, authorizeRoles('user'), responseHandler(projectController.getProjectByIdController));
router.delete('/:projectId', protect, responseHandler(projectController.deleteProjectController));
router.put('/:projectId/whatsapp-business-profile', protect, responseHandler(projectController.updateWhatsappBusinessProfileController));

// router
//   .put("/:id",
//     protect,
//     authorizeRoles('user'),
//     responseHandler(projectController.updateProjectController)
//   );
  // .delete(
  //   protect,
  //   authorizeRoles('user'),
  //   validate(validateProjectId, 'params'),
  //   responseHandler(projectController.deleteProject)
  // );

// router.delete('/:id/delete', protect, authorizeRoles('user'), responseHandler(projectController.deleteProject));
// router.put('/:projectId', protect, responseHandler(projectController.updateProjectController));

module.exports = router;
