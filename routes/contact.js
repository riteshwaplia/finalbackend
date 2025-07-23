const express = require("express");
const { protect } = require("../middleware/auth");
const responseHandler = require("../middleware/responseHandler");
const validateRequest = require("../middleware/validateRequest");
const contactController = require("../controllers/contactController");

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

// ✅ Create a new contact
router.post(
  "/",
  protect,
  validateRequest({ body: createContactSchema }),
  responseHandler(contactController.createController)
);

// ✅ Upload contact (CSV/Excel)
router.post(
  "/upload",
  protect,
  validateRequest({ body: uploadContactSchema }),
  responseHandler(contactController.uploadContactController)
);

// ✅ Get all contacts
router.get(
  "/contactList",
  protect,
  responseHandler(contactController.contactListController)
);

// ✅ Group list for contact module (STATIC - must come before dynamic route)
router.get(
  "/groupList",
  protect,
  responseHandler(contactController.groupListController)
);

// ✅ Get contact by ID
// router.get(
//   "/:contactId",
//   protect,
//   validateRequest({ params: getContactSchema }),
//   responseHandler(contactController.contactByIdController)
// );


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

module.exports = router;
