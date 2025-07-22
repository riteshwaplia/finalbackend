const { sendBulkMessageService, getAllBulkSendJobsService, getBulkSendJobDetailsService } = require('../services/messageService');
const messageService = require("../services/messageService");

exports.sendMessageController = async (req) => {
    return await messageService.sendMessageService(req);
};

exports.sendBulkMessageController = async (req) => {
    return await sendBulkMessageService(req);
};

exports.uploadMedia = async (req) => {
    return await messageService.uploadMedia(req);
};

exports.getBulkSendJobDetailsService = async (req) => {
    return await getBulkSendJobDetailsService(req);
};

exports.getAllBulkSendJobsService = async (req) => {
    return await getAllBulkSendJobsService(req);
};
exports.BulkSendGroupController = async (req) => {
    return await messageService.BulkSendGroupService(req);
};