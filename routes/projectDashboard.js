const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/auth");
const {responseHandler} = require("../middleware/responseHandler");
const validate = require("../middleware/validate");

const dashboardController = require("../controllers/dashboardController");
const {
  validateProjectDashboardStats,
} = require("../validations/projectValidation");

router.get(
  "/:projectId/dashboard/stats",
  protect,
  authorizeRoles("user"),
  responseHandler(dashboardController.getDashboardStatsController)
);

module.exports = router;