// const { statusCode, resMessage } = require("../config/constants");

// const responseHandler = (controllerFunction) => async (req, res, next) => {
//     try {
//         const result = await controllerFunction(req);

//         // ✅ Support raw plain response (e.g. for Meta webhook verification)
//         if (result?.raw) {
//             return res.status(result.status || 200).send(result.body);
//         }

//         if (result && result.status) {
//             res.status(result.status).json({
//                 success: result.success,
//                 message: result.message,
//                 data: result.data,
//                 pagination: result.pagination
//             });
//         } else {
//             console.error("Controller function did not return expected format:", result);
//             res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//                 success: false,
//                 message: resMessage.Server_error
//             });
//         }
//     } catch (error) {
//         console.error("Error caught by responseHandler:", error);
//         res.status(statusCode.INTERNAL_SERVER_ERROR).json({
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         });
//     }
// };

// module.exports = responseHandler;



// server/middleware/responseHandler.js
const responseHandler = (fn) => async (req, res, next) => {
    try {
        const result = await fn(req);

        if (result.raw) { // Custom flag to indicate raw response
            if (result.status) res.status(result.status);
            res.send(result.body);
        } else {
            res.status(result.status || 200).json({
                success: result.success,
                message: result.message,
                data: result.data
            });
        }
    } catch (error) {
        console.error("Error in response handler:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = responseHandler;
