const Joi = require("joi");
const mongoose = require("mongoose");

// Helper to validate MongoDB ObjectId
const objectIdValidator = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
}, "ObjectId Validation");

// 🔹 Create Contact Schema
const createContactSchema = Joi.object({
  name: Joi.string().required(),
  mobileNumber: Joi.string().required(),
  email: Joi.string().email().optional(),
  countryCode: Joi.string().optional(),
  groupIds: Joi.array().items(objectIdValidator).optional(),
  isBlocked: Joi.boolean().optional(),
});

// 🔹 Update Contact Schema
const updateContactSchema = Joi.object({
  name: Joi.string().optional(),
  mobile: Joi.string().optional(),
  email: Joi.string().email().optional(),
  countryCode: Joi.string().optional(),
  groupIds: Joi.array().items(objectIdValidator).optional(),
  isBlocked: Joi.boolean().optional(),
});

// 🔹 Get or Delete Contact by ID
const getContactSchema = Joi.object({
  contactId: objectIdValidator.required(),
});

// 🔹 Delete Multiple Contacts
const multiDeleteContactSchema = Joi.object({
  contactIds: Joi.array().items(objectIdValidator).min(1).required(),
});

// 🔹 Update Multiple Contacts
const multiUpdateContactSchema = Joi.object({
  contactIds: Joi.array().items(objectIdValidator).min(1).required(),
  updates: Joi.object({
    isBlocked: Joi.boolean().optional(),
    groupIds: Joi.array().items(objectIdValidator).optional(),
  }).required(),
});

// 🔹 Upload CSV/Excel Contact
const uploadContactSchema = Joi.object({
  fileName: Joi.string().required(),
  fileType: Joi.string().valid("csv", "excel").required(),
});

// 🔹 Import Contacts from CSV
const importCSVSchema = Joi.object({
  contacts: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        mobile: Joi.string().required(),
        email: Joi.string().email().optional(),
        countryCode: Joi.string().optional(),
        groupIds: Joi.array().items(objectIdValidator).optional(),
      })
    )
    .min(1)
    .required(),
});

// 🔹 Block Contact Schema
const blacklistContactSchema = Joi.object({
  contactId: objectIdValidator.required(),
});

// 🔹 Unblock Contact Schema
const removeBlockContactSchema = Joi.object({
  contactId: objectIdValidator.required(),
});

// 🔹 Bulk Remove by Group
const bulkRemoveSchema = Joi.object({
  groupId: objectIdValidator.required(),
});

module.exports = {
  createContactSchema,
  updateContactSchema,
  getContactSchema,
  deleteContactSchema: getContactSchema,
  multiDeleteContactSchema,
  multiUpdateContactSchema,
  importCSVSchema,
  blacklistContactSchema,
  removeBlockContactSchema,
  bulkRemoveSchema,
  uploadContactSchema,
};
