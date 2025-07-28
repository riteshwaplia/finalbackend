const express = require("express");
const { protect } = require("../middleware/auth");
const {responseHandler} = require("../middleware/responseHandler");
const contactController = require("../controllers/contactController");
const uploadExcel = require('../config/multerConfig');

const router = express.Router({ mergeParams: true });

router.get("/contactList", protect, contactController.contactListController);
router.get("/groupList", protect, responseHandler(contactController.groupListController));
router.put("/contact-add-customField", protect, responseHandler(contactController.addCustomFieldToContactsController)); 
router.get("/fields", protect, responseHandler(contactController.fieldListController));
router.put("/updateContact/:contactId", protect, responseHandler(contactController.updateContactController));
router.put("/blackListContact/:contactId", protect, responseHandler(contactController.blockContactController));
router.get("/blackList", protect, responseHandler(contactController.blackListController));
router.put("/removeBlackListContact/:contactId", protect, responseHandler(contactController.removeBlockContactController));
router.post("/", protect, responseHandler(contactController.createController));
router.delete("/deleteContact/:contactId", protect, responseHandler(contactController.deleteContactController));
router.put("/bulkContactUpdate/delete", protect, responseHandler(contactController.removeBulkController));
router.post("/uploadContact", protect, uploadExcel.single("excelFile"), responseHandler(contactController.uploadContactController));
// router.post("/upload", protect, responseHandler(contactController.uploadContactController));
// router.get("/:contactId", protect, responseHandler(contactController.contactByIdController));
// router.put("/:contactId", protect, responseHandler(contactController.updateContactController));
// router.delete("/:contactId", protect, responseHandler(contactController.deleteContactController));
// router.post("/bulk-delete", protect, responseHandler(contactController.removeBulkController));
// router.post("/bulk-update", protect, responseHandler(contactController.multiContactUpdateController));
// router.post("/block", protect, responseHandler(contactController.blockContactController));
// router.post("/unblock", protect, responseHandler(contactController.removeBlockContactController));
// router.post("/import-csv", protect, responseHandler(contactController.importContactsFromCSV));
// router.get("/contactById/:contactId", protect, responseHandler(contactController.contactByIdController));
// router.put("/bulkUpdate", protect, responseHandler(contactController.multiContactUpdateController));
// router.post("/bulkContactUpdate", protect, responseHandler(contactController.removeBulkController));

// router.post('/bulk-block', protect, responseHandler(contactController.bulkBlockContactController));

module.exports = router;
