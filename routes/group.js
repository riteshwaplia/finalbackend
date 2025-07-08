const express = require('express');
const { protect } = require('../middleware/auth'); // Our existing auth middleware
const groupController = require('../controllers/groupController');

const router = express.Router({ mergeParams: true }); // mergeParams is crucial for nested routes

// All group routes will be prefixed with /api/projects/:projectId/groups (as defined in app.js)

// Create a new group
router.post("/", protect, groupController.createController);
// Get all groups for a project
router.get("/", protect, groupController.getController);
// Multi-delete groups (POST with IDs in body)
router.delete("/", protect, groupController.multiDeleteController);
router.get("/archiveList", protect, groupController.archiveListController); // Renamed for clarity: was archiveGroup

// Get, Edit, Delete a specific group
router.get("/:groupId", protect, groupController.editGetController);
router.put("/:groupId", protect, groupController.editController);
router.delete("/:groupId", protect, groupController.deleteController);

// Archive and Restore a specific group
router.put("/archive/:groupId", protect, groupController.updateFalseStatusController);
router.put("/removeArchive/:groupId", protect, groupController.updateTrueStatusController);

// Get archived groups
// router.get("/archiveList", protect, groupController.archiveListController); // Renamed for clarity: was archiveGroup

// Multi-archive groups (PATCH with IDs in body)
router.patch("/archive", protect, groupController.multiUpdateController); // Original route was /project/:id/archiveGroup


module.exports = router;
