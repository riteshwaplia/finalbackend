const Joi = require("joi");

// Register (public or admin)
const registerSchema = Joi.object({ 
  username: Joi.string().min(3).max(30).required().messages({
    "string.empty": "Username is required.",
    "string.min": "Username must be at least 3 characters long.",
    "any.required": "Username is required.",
  }),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
      "string.email": "Please enter a valid email address.",
      "string.pattern.base": "Email must not contain invalid characters.",
      "any.required": "Email is required.",
    }),
  password: Joi.string()
    .pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?]).{8,}$'
      )
    )
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      "any.required": "Password is required.",
    }),
  role: Joi.string().valid("user", "tenant_admin").optional(),
});




// Login
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
      "string.email": "Please enter a valid email address.",
      "string.pattern.base": "Email must not contain invalid characters.",
      "any.required": "Email is required.",
    }),
  password: Joi.string().required().messages({
    "any.required": "Password is required.",
  }),
});


// Business profile creation
const businessProfileSchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Business name is required.",
  }),
  businessAddress: Joi.string().optional(),
  metaAccessToken: Joi.string().required().messages({
    "any.required": "Meta Access Token is required.",
  }),
  metaAppId: Joi.string().required().messages({
    "any.required": "Meta App ID is required.",
  }),
  metaBusinessId: Joi.string().required().messages({
    "any.required": "Meta Business ID is required.",
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  businessProfileSchema,
};
