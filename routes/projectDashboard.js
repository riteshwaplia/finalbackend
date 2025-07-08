// server/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/projectDashboardController');
const { protect } = require('../middleware/auth'); // Our existing auth middleware
const responseHandler = require('../middleware/responseHandler');

// Route to get dashboard statistics for a specific project
router.get('/:projectId/stats', protect, responseHandler(dashboardController.getDashboardStatsController));

module.exports = router;
