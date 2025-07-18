const express = require('express');
const { protect } = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const responseHandler = require("../middleware/responseHandler");

const router = express.Router({ mergeParams: true });

router.post("/", protect, groupController.createController);
router.get("/", protect, groupController.getController);
router.delete("/", protect, groupController.multiDeleteController);
router.get("/archiveList", protect, groupController.archiveListController);
router.get("/:groupId", protect, groupController.editGetController);
router.put("/:groupId", protect, groupController.editController);
router.delete("/:groupId", protect, groupController.deleteController);
router.put("/archive/:groupId", protect, groupController.updateFalseStatusController);
router.put("/removeArchive/:groupId", protect, groupController.updateTrueStatusController);
router.patch("/archive", protect, groupController.multiUpdateController);
router.post("/bulk-delete", protect, responseHandler(groupController.bulkDeleteController));

module.exports = router;
