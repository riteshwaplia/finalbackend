module.exports = (schemas, options = { abortEarly: false }) => {
  return (req, res, next) => {
    const locations = ["body", "params", "query"];
    const errors = [];

    for (const location of locations) {
      if (schemas[location]) {
        const { error } = schemas[location].validate(req[location], options);
        console.log(`Validating $`, error);
        if (error) {
          errors.push(
            ...(
              options.abortEarly
                ? [error.details[0].message]
                : error.details.map((detail) => detail.message)
            )
          );
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }
    console.log(errors);
    

    next();
  };
};