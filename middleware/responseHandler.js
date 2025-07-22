const { default: mongoose } = require('mongoose');

module.exports = (controllerFunction) => async (req, res, next) => {
    try {
        const result = await controllerFunction(req, res, next);

        if (!result || typeof result !== 'object') {
            throw new Error('Controller did not return a valid response object');
        }

        const { statusCode = 200, ...rest } = result;

        return res.status(+statusCode).json({
            ...rest
        });

    } catch (error) {
        console.error('Error in controller:', error);

        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({
                status: false,
                message: 'Wrong ID Format',
                data: []
            });
        }

        return res.status(500).json({
            status: false,
            message: 'Internal server error!',
            data: []
        });
    }
};
