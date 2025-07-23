// // server/routes/template.js
// const express = require('express');
// const { protect } = require('../middleware/auth');
// const responseHandler = require('../middleware/responseHandler');
// const templateController = require('../controllers/templateController');
// const mediaUpload = require('../config/multerMediaConfig');
// const { validate } = require('../validations/templateValidator'); 
// const router = express.Router(); // No mergeParams as it's no longer project-nested

// // All template routes will now be prefixed with /api/templates

// // Create a new template (locally)
// router.post("/", protect, responseHandler(templateController.createController));
// router.post('/upload-media', protect, mediaUpload.single('file'), responseHandler(templateController.uploadMedia));

// // Submit a locally created template to Meta for approval
// router.post("/:id/submit-to-meta", protect, responseHandler(templateController.submitToMetaController));

// // Get all templates for the authenticated user
// router.get("/", protect, responseHandler(templateController.getAllController));

// // Get a specific template by ID
// router.get("/:id", protect, responseHandler(templateController.getByIdController));

// // Update a template by ID
// router.put("/:id", protect, responseHandler(templateController.updateController));

// // Delete a template by ID
// router.delete("/:id", protect, responseHandler(templateController.deleteController));

// // NEW: Synchronize templates from Meta API
// router.post("/sync-from-meta", protect, responseHandler(templateController.syncTemplatesFromMetaController));

// module.exports = router;
const express = require('express');
const { protect } = require('../middleware/auth');
const responseHandler = require('../middleware/responseHandler');
const templateController = require('../controllers/templateController');
const mediaUpload = require('../config/multerMediaConfig');

const router = express.Router();

router.post("/", protect, responseHandler(templateController.createController));
router.post('/upload-media', protect, mediaUpload.single('file'), responseHandler(templateController.uploadMedia));
router.post('/carousel-templates', protect, responseHandler(templateController.createCarouselTemplateController));

// Submit a locally created template to Meta for approval
router.post("/:id/submit-to-meta", protect, responseHandler(templateController.submitToMetaController));
router.get("/", protect, responseHandler(templateController.getAllController));
router.get("/:id", protect, responseHandler(templateController.getByIdController));
router.put("/:id", protect, responseHandler(templateController.updateController));
router.delete("/:id", protect, responseHandler(templateController.deleteController));
router.post("/sync-from-meta", protect, responseHandler(templateController.syncTemplatesFromMetaController));
router.post('/auth', protect, responseHandler(templateController.authTemplateController));

module.exports = router;
