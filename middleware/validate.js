module.exports = (Schema, options = { abortEarly: false }) => {
  return (req, res, next) => {
    const { error } = Schema.validate(req.body, options);

    if (error) {
      const errors = options.abortEarly
        ? [error.details[0].message]
        : error.details.map((detail) => detail.message);

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next();
  };
};
