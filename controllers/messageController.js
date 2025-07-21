// server/controllers/messageController.js
const messageService = require("../services/messageService");

exports.sendMessageController = async (req) => {
    return await messageService.sendMessageService(req);
};

exports.sendBulkMessageController = async (req) => {
    return await messageService.sendBulkMessageService(req);
};
exports.uploadMedia = async (req) => {
    return await messageService.uploadMedia(req);
};
exports.getBulkSendJobDetailsService = async (req) => {
    return await messageService.getBulkSendJobDetailsService(req);
};
exports.getBulkSendJobDetailsService = async (req) => {
    return await messageService.getBulkSendJobDetailsService(req);
};
exports.getAllBulkSendJobsService = async (req) => {
    return await messageService.getAllBulkSendJobsService(req);
};
exports.BulkSendGroupController = async (req) => {
    return await messageService.BulkSendGroupService(req);
};