const express = require('express');
const { protect } = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const responseHandler = require("../middleware/responseHandler");
const validate = require("../middleware/validate");

const {
  createGroupSchema,
  updateGroupSchema,
  multiDeleteGroupSchema,
  unarchiveGroupSchema,
  archiveGroupSchema,
  getGroupSchema,
  editGetGroupSchema,
  deleteGroupSchema,
  bulkDeleteSchema,
  multiArchiveSchema
} = require("../validations/groupValidations");

const router = express.Router({ mergeParams: true });

// Create a group
router.post("/", protect, validate(createGroupSchema), groupController.createController);

// Get all groups
router.get("/", protect, validate(getGroupSchema), groupController.getController);

// Multi delete groups
router.delete("/", protect, validate(multiDeleteGroupSchema), groupController.multiDeleteController);

// Get archive list (reuse getGroupSchema if needed)
router.get("/archiveList", protect, validate(getGroupSchema), groupController.archiveListController);

// Get a single group for edit
router.get("/:groupId", protect, validate(editGetGroupSchema), groupController.editGetController);

// Edit/update group
router.put("/:groupId", protect, validate(updateGroupSchema), groupController.editController);

// Delete single group
router.delete("/:groupId", protect, validate(deleteGroupSchema), groupController.deleteController);

// Archive a group
router.put("/archive/:groupId", protect, validate(archiveGroupSchema), groupController.updateFalseStatusController);

// Unarchive a single group
router.put("/removeArchive/:groupId", protect, validate(archiveGroupSchema), groupController.updateTrueStatusController);

// Bulk delete groups
router.post("/bulk-delete", protect, validate(bulkDeleteSchema), responseHandler(groupController.bulkDeleteController));

// Unarchive multiple groups
router.post("/unarchive", protect, validate(unarchiveGroupSchema), responseHandler(groupController.unarchiveController));

// Multi archive groups
router.patch("/multi/archive", protect, validate(multiArchiveSchema), groupController.multiUpdateController);

module.exports = router;
