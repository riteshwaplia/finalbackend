// server/routes/templateRoutes.js
const express = require("express");
const router = express.Router();
const templateController = require("../controllers/admintemplateController");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");

router.post("/", protect, responseHandler(templateController.createController));

router.get("/", protect, responseHandler(templateController.getAllController));

router.get("/:id", protect, responseHandler(templateController.getByIdController));

router.put("/:id", protect, responseHandler(templateController.updateController));

router.delete("/:id", protect, responseHandler(templateController.deleteController));

module.exports = router;
