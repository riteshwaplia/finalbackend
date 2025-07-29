const Joi = require("joi");

exports.register = Joi.object({
  username: Joi.string().trim().required().messages({
    "any.required": "Username is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string().trim().min(6).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  }),
});

exports.login = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string().trim().required().messages({
    "any.required": "Password is required",
  }),
});

exports.update = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "any.required": "Email is required",
      "string.email": "Please provide a valid email",
    }),

  username: Joi.string()
    .trim()
    .optional(),

  firstName: Joi.string()
    .trim()
    .optional(),

  lastName: Joi.string()
    .trim()
    .optional(),

  mobileNumber: Joi.string()
    .trim()
    .length(10)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      "string.length": "Mobile number must be 10 digits",
      "string.pattern.base": "Mobile number must be numeric",
    }),

  profilePicture: Joi.string()
    .trim()
    .uri()
    .optional()
    .messages({
      "string.uri": "Profile picture must be a valid URI",
    }),

  gender: Joi.string()
    .valid("male", "female", "other")
    .optional()
    .messages({
      "any.only": "Gender must be one of: male, female, other",
    }),

  dob: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format": "Date of birth must be in ISO format (YYYY-MM-DD)",
    }),
});


exports.forgotPassword = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
});

exports.resetPassword = Joi.object({
  oldPassword: Joi.string()
    .trim()
    .required()
    .messages({
      "any.required": "Old password is required",
    }),

  newPassword: Joi.string()
    .trim()
    .min(6)
    .required()
    .messages({
      "any.required": "New password is required",
      "string.min": "Password must be at least 6 characters long",
    }),
});

exports.resetPasswordWithOtp = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "any.required": "Email is required",
      "string.email": "Please provide a valid email",
    }),

  otp: Joi.string()
    .trim()
    .length(6)
    .pattern(/^[A-Za-z]{6}$/)
    .required()
    .messages({
      "any.required": "OTP is required",
      "string.length": "OTP must be 6 characters",
      "string.pattern.base": "OTP must contain only letters (A-Z, a-z)",
    }),

  newPassword: Joi.string()
    .trim()
    .min(6)
    .required()
    .messages({
      "any.required": "New password is required",
      "string.min": "Password must be at least 6 characters long",
    }),
});

exports.verifyOtp = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  otp: Joi.string()
    .trim()
    .length(6)
    .pattern(/^[A-Za-z]{6}$/)
    .required()
    .messages({
      "any.required": "OTP is required",
      "string.length": "OTP must be 6 characters",
      "string.pattern.base": "OTP must contain only letters (A-Z, a-z)",
    }),
});

