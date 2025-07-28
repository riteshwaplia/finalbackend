const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const validateRequest = require('../middleware/validateRequest');
const teamMemberController = require('../controllers/teamMemberController');
const {
  createTeamMemberSchema,
  getAllTeamMembersSchema,
  getOrDeleteTeamMemberSchema,
  updateTeamMemberSchema
} = require('../validations/teamMemberValidation');

const router = express.Router({ mergeParams: true });

router.post(
  "/",
  protect,
  validateRequest(createTeamMemberSchema),
  responseHandler(teamMemberController.createController)
);

router.get(
  "/",
  protect,
  validateRequest(getAllTeamMembersSchema),
  responseHandler(teamMemberController.getAllController)
);

router.get(
  "/:id",
  protect,
  validateRequest(getOrDeleteTeamMemberSchema),
  responseHandler(teamMemberController.getByIdController)
);

router.put(
  "/:id",
  protect,
  validateRequest(updateTeamMemberSchema),
  responseHandler(teamMemberController.updateController)
);

router.delete(
  "/:id",
  protect,
  validateRequest(getOrDeleteTeamMemberSchema),
  responseHandler(teamMemberController.deleteController)
);

module.exports = router;
