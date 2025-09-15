const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/catalogController");

const router = express.Router();

router.post("/:businessProfileId", protect, responseHandler(controller.createContactController));
router.get("/:businessProfileId", protect, responseHandler(controller.catalogListController));
router.get("/sync/:businessProfileId", protect, responseHandler(controller.syncCatalogsController));

module.exports = router;