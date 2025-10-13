const service = require('../services/catalogService');
const { statusCode } = require("../config/constants");

exports.createContactController = async (req) => {
    try {
        return await service.create(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.catalogListController = async (req) => {
    try {
        return await service.catalogList(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.syncCatalogsController = async (req) => {
    try {
        return await service.syncCatalogs(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.deleteCatalogController = async (req) => {
    try {
        return await service.deleteCatalog(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}

exports.switchCatalogController = async (req) => {
    try {
        return await service.switchCatalog(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        }
    }
}