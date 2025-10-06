const service = require("../services/metaFlows");
const { statusCode } = require("../config/constants");

exports.createMetaFlows = async (req) => {
  try {
    return await service.createMetaFlowsService(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};
exports.syncMetaFlows = async (req) => {
  try {
    return await service.syncMetaFlowsService(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.listMetaFlows = async (req) => {
  try {
    return await service.listMetaFlowsService(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};