const express = require("express");
const { protect } = require("../middleware/auth");
const responseHandler = require("../middleware/responseHandler");
const validateRequest = require("../middleware/validateRequest");
const contactController = require("../controllers/contactController");
const uploadExcel = require('../config/multerConfig');

const {
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
  getContactSchema,
  multiDeleteContactSchema,
  importCSVSchema,
  multiUpdateContactSchema,
  blacklistContactSchema,
  removeBlockContactSchema,
  bulkRemoveSchema,
  uploadContactSchema,
} = require("../validations/contactValidation");

const router = express.Router({ mergeParams: true });

// ✅ Upload contact (CSV/Excel)
router.post(
  "/upload",
  protect,
  validateRequest({ body: uploadContactSchema }),
  responseHandler(contactController.uploadContactController)
);

router.get(
  "/:contactId",
  protect,
  validateRequest({ params: getContactSchema }),
  responseHandler(contactController.contactByIdController)
);
// ✅ Update contact by ID
router.put(
  "/:contactId",
  protect,
  validateRequest({ params: getContactSchema, body: updateContactSchema }),
  responseHandler(contactController.updateContactController)
);

// ✅ Delete contact by ID
router.delete(
  "/:contactId",
  protect,
  validateRequest({ params: deleteContactSchema }),
  responseHandler(contactController.deleteContactController)
);

// ✅ Bulk delete contacts
router.post(
  "/bulk-delete",
  protect,
  validateRequest({ body: multiDeleteContactSchema }),
  responseHandler(contactController.removeBulkController)
);

// ✅ Bulk update contacts
router.post(
  "/bulk-update",
  protect,
  validateRequest({ body: multiUpdateContactSchema }),
  responseHandler(contactController.multiContactUpdateController)
);

// ✅ Block contact
router.post(
  "/block",
  protect,
  validateRequest({ body: blacklistContactSchema }),
  responseHandler(contactController.blockContactController)
);

// ✅ Unblock contact
router.post(
  "/unblock",
  protect,
  validateRequest({ body: removeBlockContactSchema }),
  responseHandler(contactController.removeBlockContactController)
);

// ✅ Import from CSV
router.post(
  "/import-csv",
  protect,
  validateRequest({ body: importCSVSchema }),
  responseHandler(contactController.importContactsFromCSV)
);

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

router.put("/contact-add-customField", protect, responseHandler(contactController.addCustomFieldToContactsController)); 

module.exports = router;
