const service = require('../services/productService');
const { statusCode } = require("../config/constants");

exports.createProductController = async (req) => {
    try {
        return await service.createProduct(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}