const Joi = require("joi");

exports.register = Joi.object({
    username: Joi.string()
        .trim()
        .required()
        .messages({
            "any.required": "Username is required",
        }),
    email: Joi.string()
        .email()
        .trim()
        .required()
        .messages({
            "any.required": "Email is required",
            "string.email": "Please provide a valid email",
        }),
    password: Joi.string()
        .trim()
        .min(6)
        .required()
        .messages({
            "any.required": "Password is required",
            "string.min": "Password must be at least 6 characters long",
        }),
    firstName: Joi.string()
        .trim()
        .required()
        .messages({
            "any.required": "First name is required",
        }),
    lastName: Joi.string()
        .trim()
        .required()
        .messages({
            "any.required": "Last name is required",
        }),
    mobileNumber: Joi.string()
        .trim()
        .length(10)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            "any.required": "Mobile number is required",
            "string.length": "Mobile number must be 10 digits",
            "string.pattern.base": "Mobile number must be numeric",
        }),
    confirmPassword: Joi.string()
        .trim()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "any.required": "Confirm password is required",
            "any.only": "Confirm password does not match",
        }),
});  // done testing 

exports.login = Joi.object({
    email: Joi.string()
        .trim()
        .email()
        .required()
        .messages({
            "any.required": "Email is required",
            "string.email": "Please provide a valid email",
        }),
    password: Joi.string()
        .trim()
        .required()
        .messages({
            "any.required": "Password is required",
        }),
}); //done testing 

exports.update = Joi.object({
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
    email: Joi.string()
        .email()
        .trim()
        .optional()
        .messages({
            "string.email": "Please provide a valid email",
        }),
    password: Joi.string()
        .trim()
        .min(6)
        .optional()
        .messages({
            "string.min": "Password must be at least 6 characters long",
        }),
});  //done

exports.forgotPassword = Joi.object({
    email: Joi.string()
        .email()
        .trim()
        .required()
        .messages({
            "any.required": "Email is required",
            "string.email": "Please provide a valid email",
        }),
});  //done 

exports.resetPassword = Joi.object({
    token: Joi.string()
        .trim()
        .required()
        .messages({
            "any.required": "Token is required",
        }),
    newPassword: Joi.string()
        .trim()
        .min(6)
        .required()
        .messages({
            "any.required": "New password is required",
            "string.min": "Password must be at least 6 characters long",
        }),
});  //done

exports.verifyOtp = Joi.object({
    email: Joi.string()
        .email()
        .trim()
        .required()
        .messages({
            "any.required": "Email is required",
            "string.email": "Please provide a valid email",
        }),
    otp: Joi.string()
        .trim()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            "any.required": "OTP is required",
            "string.length": "OTP must be 6 digits",
            "string.pattern.base": "OTP must be numeric",
        }),
}); //done testing 
