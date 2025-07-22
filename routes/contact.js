const express = require('express');
const { protect } = require('../middleware/auth');
const responseHandler = require('../middleware/responseHandler');
const uploadExcel = require('../config/multerConfig');
const contactController = require('../controllers/contactController');

const router = express.Router({ mergeParams: true });

router.post("/", protect, responseHandler(contactController.createController));
router.post("/uploadContact", protect, uploadExcel.single("excelFile"), responseHandler(contactController.uploadContactController));
router.get("/contactList", protect, responseHandler(contactController.contactListController));
router.put("/blackListContact/:contactId", protect, responseHandler(contactController.blockContactController));
router.get("/groupList", protect, responseHandler(contactController.groupListController));
router.get("/contactById/:contactId", protect, responseHandler(contactController.contactByIdController));
router.put("/updateContact/:contactId", protect, responseHandler(contactController.updateContactController));
router.delete("/deleteContact/:contactId", protect, responseHandler(contactController.deleteContactController));
router.put("/bulkUpdate", protect, responseHandler(contactController.multiContactUpdateController));
router.get("/blackList", protect, responseHandler(contactController.blackListController));
router.put("/removeBlackListContact/:contactId", protect, responseHandler(contactController.removeBlockContactController));

// Remove contacts in bulk (delete many)
router.put("/bulkContactUpdate/delete", protect, responseHandler(contactController.removeBulkController)); // Note: Original was /bulkContactUpdate
router.post("/bulkContactUpdate", protect, responseHandler(contactController.removeBulkController));
router.post('/bulk-block', protect, responseHandler(contactController.bulkBlockContactController));

module.exports = router;
