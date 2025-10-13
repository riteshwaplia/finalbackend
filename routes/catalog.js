const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/catalogController");

const router = express.Router();

router.post("/:businessProfileId", protect, responseHandler(controller.createContactController));
router.get("/:businessProfileId", protect, responseHandler(controller.catalogListController));
router.get("/sync/:businessProfileId", protect, responseHandler(controller.syncCatalogsController));
router.delete("/:catalogId", protect, responseHandler(controller.deleteCatalogController));
router.post("/switch-catalog/:businessProfileId", protect, responseHandler(controller.switchCatalogController));
router.get("/active/:businessProfileId", protect, responseHandler(controller.getActiveCatalogController));

module.exports = router;