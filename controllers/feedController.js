const service = require("../services/feedService");
const { statusCode } = require("../config/constants");

exports.createFeedController = async (req) => {
  try {
    return await service.createFeed(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};
exports.syncFeedController = async (req) => {
  try {
    return await service.syncFeed(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.updateFeedController = async (req) => {
  try {
    return await service.updateFeed(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.getFeedController = async (req) => {
  try {
    return await service.getFeed(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.listFeedsController = async (req) => {
  try {
    return await service.listFeeds(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};
exports.deleteFeedController = async (req) => {
  try {
    return await service.deleteFeed(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};
