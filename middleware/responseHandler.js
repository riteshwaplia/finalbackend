const { statusCode, resMessage } = require("../config/constants");

exports.responseHandler = (controllerFunction) => async (req, res, next) => {
    try {
        const result = await controllerFunction(req);

        // ✅ Support raw plain response (e.g. for Meta webhook verification)
        if (result?.raw) {
            return res.status(result.status || 200).send(result.body);
        }

        if (result && result.status) {
            res.status(result.status).json({
                success: result.success,
                message: result.message,
                data: result.data,
                pagination: result.pagination
            });
        } else {
            console.error("Controller function did not return expected format:", result);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: resMessage.Server_error
            });
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
