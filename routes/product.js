const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/productController");

const router = express.Router();

router.post("/:catalogId", protect, responseHandler(controller.createProductController));
router.get("/:catalogId", protect, responseHandler(controller.listProductsController));
router.get("/:catalogId/name", protect, responseHandler(controller.listProductsNameController));
router.get("/sync/:catalogId", protect, responseHandler(controller.syncProductController));
router.delete("/:productId", protect, responseHandler(controller.deleteProductController));
router.put("/:productId", protect, responseHandler(controller.editProductController));

module.exports = router;