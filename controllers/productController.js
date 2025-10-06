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

exports.listProductsController = async (req) => {
    try {
        return await service.listProducts(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.listProductsNameController = async (req) => {
    try {
        return await service.listProductsName(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.syncProductController = async (req) => {
    try {
        return await service.syncProduct(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.deleteProductController = async (req) => {
    try {
        return await service.deleteProduct(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.editProductController = async (req) => {
    try {
        return await service.editProduct(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}