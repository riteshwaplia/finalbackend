const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    return req.body.email || ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json({
      status: options.statusCode,
      success: false,
      message: 'Too many login attempts for this account. Try again in a minute.',
    });
  }
});

const sendGroupMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => {
    return req.body.groupId || ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json({
      status: options.statusCode,
      success: false,
      message: 'Too many login attempts for this account. Try again in a minute.',
    });
  }
});

module.exports = {
  loginLimiter,
  sendGroupMessageLimiter
}