const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const projectController = require('../controllers/projectController');
const {responseHandler} = require('../middleware/responseHandler');

router.route('/')
  .post(
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.createProject)
  )
  .get(
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.getAllProjectsController)
  );

router.get('/:id/dashboard', protect, authorizeRoles('user'), responseHandler(projectController.getProjectByIdController));
router
  .put("/:id",
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.updateProject)
  );
  // .delete(
  //   protect,
  //   authorizeRoles('user'),
  //   validate(validateProjectId, 'params'),
  //   responseHandler(projectController.deleteProject)
  // );

router.delete('/:id/delete', protect, authorizeRoles('user'), responseHandler(projectController.deleteProject));
router.put('/:projectId', protect, responseHandler(projectController.updateProjectController));
router.delete('/:projectId', protect, responseHandler(projectController.deleteProjectController));
router.put('/:projectId/whatsapp-business-profile', protect, responseHandler(projectController.updateWhatsappBusinessProfileController));

module.exports = router;
