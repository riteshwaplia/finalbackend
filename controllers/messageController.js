const { sendBulkMessageService, sendBulkCatalogService , getAllBulkSendJobsService, getBulkSendJobDetailsService , sendBulkCatalogService } = require('../services/messageService');
const messageService = require("../services/messageService");
const fs = require("fs");
const path = require("path");

exports.sendMessageController = async (req) => {
    return await messageService.sendMessageService(req);
};

exports.sendBulkMessageController = async (req) => {
    return await sendBulkMessageService(req);
};
exports.ScheduleBulkSendServiceController = async (req) => {
  return await messageService.ScheduleBulkSendService(req);
};

exports.sendBulkCatalogController = async (req) => {
    return await sendBulkCatalogService(req);
};

exports.uploadMedia = async (req) => {
    return await messageService.uploadMedia(req);
};

exports.getBulkSendJobDetailsService = async (req) => {
    return await getBulkSendJobDetailsService(req);
};

exports.getAllBulkSendJobsService = async (req) => {
    return await messageService.getAllBulkSendJobsService(req);
};
exports.BulkSendGroupController = async (req) => {
    return await messageService.BulkSendGroupService(req);
};
exports.sendBulkCarouselMessage = async (req) => {
    return await messageService.sendBulkCarouselMessageService(req);
};
exports.downloadMediaControllerRaw = async (req, res) => {
  const result = await messageService.downloadMedia(req);

  if (!result.success) {
    return res.status(result.status).json({
      success: false,
      message: result.message,
      error: result.error,
    });
  }

  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  result.stream.pipe(res);
};
