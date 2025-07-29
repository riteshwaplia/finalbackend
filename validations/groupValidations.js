const Joi = require("joi");

const titleValidation = Joi.string()
  .trim()
  .pattern(/^[^<>]*$/, "no angle brackets")
  .messages({
    "string.pattern.name": "Group title must not contain '<' or '>'",
    "string.empty": "Group title cannot be empty",
    "any.required": "Group title is required",
  });

const createGroup = Joi.object({
  title: titleValidation.required(),
  description: Joi.string().trim().allow('', null).optional().messages({
    "string.base": "Description must be a string",
  }),
});

const updateGroup = Joi.object({
  title: titleValidation.optional(),
  description: Joi.string().trim().allow('', null).optional().messages({
    "string.base": "Description must be a string",
  }),
  profilePicture: Joi.string()
    .trim()
    .uri()
    .allow('', null)
    .optional()
    .messages({
      "string.uri": "Profile picture must be a valid URI",
    }),
  memberIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .optional()
    .messages({
      "string.hex": "Each member ID must be a valid hex string",
      "string.length": "Each member ID must be 24 characters long",
    }),
  isPrivate: Joi.boolean().optional().messages({
    "boolean.base": "isPrivate must be true or false",
  }),
});

const multiArchiveUpdate = Joi.object({
  ids: Joi.array()
    .items(
      Joi.string().hex().length(24).messages({
        "string.hex": "Each group ID must be a valid hex string",
        "string.length": "Each group ID must be 24 characters long",
      })
    )
    .required()
    .messages({
      "array.base": "ids must be an array of group IDs",
      "any.required": "ids field is required",
    }),
});

module.exports = {
  createGroup,
  updateGroup,
  multiArchiveUpdate,
};