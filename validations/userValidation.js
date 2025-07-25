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

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required'
  }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'any.required': 'OTP is required'
  })
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
  name: Joi.string()
    .pattern(/^[a-zA-Z0-9 ]+$/)
    .required()
    .messages({
      "string.pattern.base": "Business name should not contain special characters.",
      "any.required": "Business name is required.",
    }),

  businessAddress: Joi.string().optional(),

  metaAccessToken: Joi.string()
    .required()
    .messages({
      "any.required": "Meta Access Token is required.",
    }),

  metaAppId: Joi.string()
    .required()
    .messages({
      "any.required": "Meta App ID is required.",
    }),

  metaBusinessId: Joi.string()
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.pattern.base": "Meta Business ID must contain digits only.",
      "any.required": "Meta Business ID is required.",
    }),
});

const getAllBusinessProfilesSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[a-zA-Z0-9]+$/) // only alphanumeric characters
    .length(24) // optional: restrict to 24 chars (MongoDB ObjectId format)
    .required()
    .messages({
      "string.pattern.base": "User ID must not contain special characters.",
      "string.length": "User ID must be 24 characters long.",
      "any.required": "User ID is required.",
    }),

  tenantId: Joi.string()
    .pattern(/^[a-zA-Z0-9]+$/)
    .length(24)
    .required()
    .messages({
      "string.pattern.base": "Tenant ID must not contain special characters.",
      "string.length": "Tenant ID must be 24 characters long.",
      "any.required": "Tenant ID is required.",
    }),
});


//  Only alphanumeric hex string (24 characters)
const objectId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "ID must be a valid 24-character hex string without special characters.",
    "any.required": "ID is required.",
});

const updateBusinessProfileSchema = Joi.object({
  businessProfileId: objectId.label("Business Profile ID"),
  userId: objectId.label("User ID"),
  tenantId: objectId.label("Tenant ID"),
  name: Joi.string()
    .pattern(/^[a-zA-Z0-9\s]+$/)
    .required()
    .messages({
      "string.pattern.base": "Business name must not contain special characters.",
      "any.required": "Business name is required."
    }),
  businessAddress: Joi.string().optional(),
  metaAccessToken: Joi.string().required().messages({
    "any.required": "Meta Access Token is required."
  }),
  metaAppId: Joi.string().required().messages({
    "any.required": "Meta App ID is required."
  }),
  metaBusinessId: Joi.string()
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.pattern.base": "Meta Business ID must contain only digits.",
      "any.required": "Meta Business ID is required."
    }),
});

const registerUserByAdminSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9\s]+$/)
    .required()
    .messages({
      "string.pattern.base": "Username must not contain special characters.",
      "any.required": "Username is required."
    }),
  email: Joi.string().email().required().messages({
    "string.email": "Enter a valid email address.",
    "any.required": "Email is required."
  }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters.",
      "string.pattern.base": "Password must contain upper, lower case letters and a number.",
      "any.required": "Password is required."
    }),
  role: Joi.string()
    .valid("tenant_admin", "user")
    .required()
    .messages({
      "any.only": "Role must be either 'tenant_admin' or 'user'.",
      "any.required": "Role is required."
    }),
  tenantId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid tenant ID format.",
      "any.required": "Tenant ID is required."
    })
});



const getUsersByTenantSchema = Joi.object({
  tenantId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid tenant ID format.",
      "any.required": "Tenant ID is required."
    })
});


const updateUserProfileSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_ ]*$/)
    .min(3)
    .max(30)
    .optional()
    .messages({
      "string.pattern.base": "Username can only contain letters, numbers, spaces, and underscores.",
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      "string.email": "Please provide a valid email address.",
    }),
  password: Joi.string()
    .min(6)
    .optional()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
    }),
});

const getUserProfileSchema = Joi.object({
  user: Joi.object({
    _id: Joi.string().pattern(/^[a-f\d]{24}$/i).required(),
    username: Joi.string().required(),
    email: Joi.string().email().required(),
    role: Joi.string().valid('user', 'tenant_admin', 'super_admin').required(),
    tenantId: Joi.string().pattern(/^[a-f\d]{24}$/i).required()
  }).required(),

  tenant: Joi.object({
    _id: Joi.string().pattern(/^[a-f\d]{24}$/i).required()
  }).required()
});

module.exports = {
  registerSchema,
  loginSchema,
  businessProfileSchema,
  getAllBusinessProfilesSchema,
  updateBusinessProfileSchema,
  registerUserByAdminSchema,
  getUsersByTenantSchema,
  updateUserProfileSchema,
  getUserProfileSchema
};
