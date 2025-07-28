const Joi = require("joi");

// Parameter schema inside components
const componentParameterSchema = Joi.object({
  type: Joi.string()
    .valid('text', 'currency', 'date_time', 'image', 'document', 'video')
    .required()
    .messages({
      'any.required': `"type" is required in parameter`,
      'any.only': `"type" must be one of text, currency, date_time, image, document, or video`,
    }),
  text: Joi.string().optional(),
  example: Joi.any().optional(),
});

// Component schema
const componentSchema = Joi.object({
  type: Joi.string()
    .valid('HEADER', 'BODY', 'FOOTER', 'BUTTONS')
    .required()
    .messages({
      'any.required': `"type" is required in component`,
      'any.only': `"type" in component must be one of HEADER, BODY, FOOTER, or BUTTONS`,
    }),
  sub_type: Joi.string().optional(),
  index: Joi.number().optional(),
  parameters: Joi.array().items(componentParameterSchema).optional(),
});

// Validation for template creation
exports.createTemplateSchema = Joi.object({
  name: Joi.string().trim().min(3).required().messages({
    'string.base': `"name" should be a type of text`,
    'string.empty': `"name" cannot be empty`,
    'string.min': `"name" should have at least 3 characters`,
    'any.required': `"name" is required`,
  }),
  category: Joi.string().valid("MARKETING", "UTILITY", "AUTHENTICATION").required().messages({
    'any.only': `"category" must be one of MARKETING, UTILITY, or AUTHENTICATION`,
    'any.required': `"category" is required`,
  }),
  language: Joi.string().required().messages({
    'string.base': `"language" must be a string`,
    'string.empty': `"language" cannot be empty`,
    'any.required': `"language" is required`,
  }),
  components: Joi.array().items(componentSchema).optional(),
  businessProfileId: Joi.string().required().messages({
    'string.base': `"businessProfileId" must be a valid string`,
    'any.required': `"businessProfileId" is required`,
  }),
});

// Validation for submitting a template to Meta
exports.submitToMetaSchema = Joi.object({
  businessProfileId: Joi.string().required().messages({
    'any.required': `"businessProfileId" is required`,
  }),
});

// Validation for updating a template
exports.updateTemplateSchema = Joi.object({
  name: Joi.string().trim().min(3).optional().messages({
    'string.base': `"name" should be a type of text`,
    'string.min': `"name" should have at least 3 characters`,
  }),
  category: Joi.string().valid("MARKETING", "UTILITY", "AUTHENTICATION").optional().messages({
    'any.only': `"category" must be one of MARKETING, UTILITY, or AUTHENTICATION`,
  }),
  language: Joi.string().optional().messages({
    'string.base': `"language" must be a string`,
  }),
  components: Joi.array().items(componentSchema).optional(),
  businessProfileId: Joi.string().required().messages({
    'any.required': `"businessProfileId" is required`,
  }),
});

// Validation for syncing templates from Meta
exports.syncFromMetaSchema = Joi.object({
  businessProfileId: Joi.string().required().messages({
    'any.required': `"businessProfileId" is required`,
  }),
});
