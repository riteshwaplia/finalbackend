const express = require('express');
const { protect } = require('../middleware/auth'); // Our existing auth middleware
const responseHandler = require('../middleware/responseHandler'); // Our custom response handler
const uploadExcel = require('../config/multerConfig'); // Multer config
const contactController = require('../controllers/contactController');

const router = express.Router({ mergeParams: true }); // mergeParams is crucial for nested routes

// All contact routes will be prefixed with /api/projects/:projectId/contacts (as defined in app.js)

// Create a new contact
router.post("/", protect, responseHandler(contactController.createController));

// Upload contacts from an Excel/CSV file
// Make sure 'excelFile' matches the field name in your form/frontend upload
router.post("/uploadContact", protect, uploadExcel.single("excelFile"), responseHandler(contactController.uploadContactController));

// Get all contacts for a project (non-blacklisted)
router.get("/contactList", protect, responseHandler(contactController.contactListController));

// Block a contact
router.put("/blackListContact/:contactId", protect, responseHandler(contactController.blockContactController));

// Get list of groups associated with the project (for filtering contacts, etc.)
router.get("/groupList", protect, responseHandler(contactController.groupListController));

// Get contact by ID
router.get("/contactById/:contactId", protect, responseHandler(contactController.contactByIdController));

// Update a contact
router.put("/updateContact/:contactId", protect, responseHandler(contactController.updateContactController));

// Delete a contact
router.delete("/deleteContact/:contactId", protect, responseHandler(contactController.deleteContactController));

// Bulk update contacts (e.g., assign to group, block/unblock, etc.)
router.put("/bulkUpdate", protect, responseHandler(contactController.multiContactUpdateController)); // Note: Original was /bulkUpdate/

// Get blacklisted contacts
router.get("/blackList", protect, responseHandler(contactController.blackListController));

// Remove contact from blacklist
router.put("/removeBlackListContact/:contactId", protect, responseHandler(contactController.removeBlockContactController));

// Remove contacts in bulk (delete many)
router.put("/bulkContactUpdate/delete", protect, responseHandler(contactController.removeBulkController)); // Note: Original was /bulkContactUpdate

module.exports = router;
