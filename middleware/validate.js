module.exports = (Schema, location = 'body', options = { abortEarly: false }) => {
  return (req, res, next) => {
    const data = req[location]; // Dynamically select the correct data based on the location parameter
    const { error } = Schema.validate(data, options);

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
