const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/templateCategoryController");
const { protect } = require('../middleware/auth');
const { responseHandler } = require("../middleware/responseHandler");

router.post("/", protect, responseHandler(categoryController.createController));
router.get("/", protect, responseHandler(categoryController.getAllController));
router.get("/:id", protect, responseHandler(categoryController.getByIdController));
router.put("/:id", protect, responseHandler(categoryController.updateController));
router.delete("/:id", protect, responseHandler(categoryController.deleteController));

router.get("/:categoryId/templates", protect, responseHandler(categoryController.getTemplatesByCategoryController));

module.exports = router;
