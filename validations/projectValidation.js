const Joi = require("joi");

// ===== CREATE Project Schema =====
const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    "string.base": "Project name must be a string.",
    "string.empty": "Project name is required.",
    "string.min": "Project name must be at least 3 characters.",
    "any.required": "Project name is required."
  }),

  description: Joi.string().allow(null, "").max(1000).messages({
    "string.base": "Description must be a string.",
    "string.max": "Description cannot exceed 1000 characters."
  }),

  businessProfileId: Joi.string().required().messages({
    "string.empty": "Business Profile ID is required.",
    "any.required": "Business Profile ID is required."
  }),

  isWhatsappVerified: Joi.boolean().optional(),

  assistantName: Joi.string().allow(null, "").max(100).messages({
    "string.max": "Assistant name must not exceed 100 characters."
  }),

  metaPhoneNumberID: Joi.string().required().messages({
    "string.empty": "Meta Phone Number ID is required.",
    "any.required": "Meta Phone Number ID is required."
  }),

  whatsappNumber: Joi.string().required().messages({
    "string.empty": "WhatsApp number is required.",
    "any.required": "WhatsApp number is required."
  }),

  activePlan: Joi.string().allow(null, "").optional(),
  planDuration: Joi.string().allow(null, "").optional(),

  // Optional timestamps and user tracking fields
  createdBy: Joi.string().optional(),
  updatedBy: Joi.string().optional()
});

// ===== UPDATE Project Schema =====
const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).messages({
    "string.base": "Project name must be a string.",
    "string.min": "Project name must be at least 3 characters."
  }),

  description: Joi.string().allow(null, "").max(1000).messages({
    "string.base": "Description must be a string.",
    "string.max": "Description cannot exceed 1000 characters."
  }),

  businessProfileId: Joi.string().messages({
    "string.base": "Business Profile ID must be a string."
  }),

  isWhatsappVerified: Joi.boolean(),

  assistantName: Joi.string().allow(null, "").max(100).messages({
    "string.max": "Assistant name must not exceed 100 characters."
  }),

  metaPhoneNumberID: Joi.string().messages({
    "string.base": "Meta Phone Number ID must be a string."
  }),

  whatsappNumber: Joi.string().messages({
    "string.base": "WhatsApp number must be a string."
  }),

  activePlan: Joi.string().allow(null, ""),
  planDuration: Joi.string().allow(null, ""),

  updatedBy: Joi.string().optional()
});

// ===== GET, DELETE, UPDATE :id Schema =====
const idParamSchema = Joi.object({
  id: Joi.string().required().messages({
    "string.empty": "Project ID is required in route.",
    "any.required": "Project ID is required."
  })
});

// ===== Optional: Middleware Wrapper =====
const validateWithSchema = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    return {
      isValid: false,
      errors: error.details.map((e) => e.message)
    };
  }
  return { isValid: true, value };
};

module.exports = {
  validateCreateProject: (data) => validateWithSchema(createProjectSchema, data),
  validateUpdateProject: (data) => validateWithSchema(updateProjectSchema, data),
  validateProjectId: (params) => validateWithSchema(idParamSchema, params)
};
