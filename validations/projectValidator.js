const Joi = require("joi");

const projectIdParamSchema = Joi.object({
  projectId: Joi.string().required().messages({
    "string.base": "Project ID must be a string.",
    "string.empty": "Project ID is required.",
    "any.required": "Project ID is required.",
  }),
});

module.exports = {
  // ...other validators
  validateProjectDashboardStats: (params) =>
    projectIdParamSchema.validate(params, { abortEarly: false }),
};
