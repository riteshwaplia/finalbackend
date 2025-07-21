const express = require('express');
const { protect } = require('../middleware/auth');
const responseHandler = require('../middleware/responseHandler');
const uploadExcel = require('../config/multerConfig'); // Using multer config for Excel uploads
const messageController = require('../controllers/messageController');
const mediaUpload = require('../config/multerMediaConfig');

const router = express.Router({ mergeParams: true }); // mergeParams is crucial for nested routes

// All message routes will be prefixed with /api/projects/:projectId/messages

// Send a single message
router.post("/send", protect, responseHandler(messageController.sendMessageController));

// Send bulk messages from an Excel file
// 'file' is the name of the input field in the form that contains the Excel file
router.post("/bulk-messages", protect, uploadExcel.single("file"), responseHandler(messageController.sendBulkMessageController));
// router.post("/upload", protect, mediaUpload.single("file"), responseHandler(messageController.uploadMedia));
router.post('/upload-media', protect, mediaUpload.single('file'), responseHandler(messageController.uploadMedia));

router.get('/bulk-send-jobs', protect, responseHandler(messageController.getAllBulkSendJobsService));

// NEW: Route to get details of a specific bulk send job
router.get('/bulk-send-jobs/:bulkSendJobId', protect, responseHandler(messageController.getBulkSendJobDetailsService));

router.post('/bulk-send-group', protect, responseHandler(messageController.BulkSendGroupService));

// You might add routes for message history, delivery reports later

module.exports = router;