const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/productController");

const router = express.Router();

router.post("/:catalogId", protect, responseHandler(controller.createProductController));
router.get("/:catalogId", protect, responseHandler(controller.listProductsController));

module.exports = router;