const Joi = require("joi");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message("Invalid ID format");

exports.createTeamMemberSchema = Joi.object({
  body: Joi.object({
    firstName: Joi.string().required().messages({
      "any.required": `"firstName" is required`,
      "string.base": `"firstName" must be a string`
    }),
    lastName: Joi.string().optional(),
    mobileNumber: Joi.string().required().messages({
      "any.required": `"mobileNumber" is required`
    }),
    username: Joi.string().required().messages({
      "any.required": `"username" is required`
    }),
    email: Joi.string().email().required().messages({
      "any.required": `"email" is required`,
      "string.email": `"email" must be a valid email`
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": `"password" is required`,
      "string.min": `"password" should be at least 6 characters`
    }),
    permissions: Joi.array().items(Joi.string()).optional()
  }),
  params: Joi.object({
    projectId: objectId.required().messages({ "any.required": `"projectId" is required` })
  }),
  query: Joi.object()
});

exports.getOrDeleteTeamMemberSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required(),
    id: objectId.required()
  }),
  query: Joi.object(),
  body: Joi.object()
});

exports.getAllTeamMembersSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required()
  }),
  query: Joi.object(),
  body: Joi.object()
});

exports.updateTeamMemberSchema = Joi.object({
  body: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    mobileNumber: Joi.string().optional(),
    username: Joi.string().optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
    role: Joi.string().valid('team-member').optional()
  }),
  params: Joi.object({
    projectId: objectId.required(),
    id: objectId.required()
  }),
  query: Joi.object()
});
