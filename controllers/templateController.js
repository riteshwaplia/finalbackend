// server/controllers/templateController.js
const templateService = require('../services/templateService');

exports.createController = async (req) => {
    return await templateService.createTemplate(req);
};
exports.uploadMedia = async (req) => {
    return await templateService.uploadMedia(req);
};

exports.submitToMetaController = async (req) => {
    return await templateService.submitTemplateToMeta(req);
};

exports.getAllController = async (req) => {
    return await templateService.getAllTemplates(req);
};

exports.getByIdController = async (req) => {
    return await templateService.getTemplateById(req);
};

exports.updateController = async (req) => {
    return await templateService.updateTemplate(req);
};

exports.deleteController = async (req) => {
    return await templateService.deleteTemplate(req);
};

// NEW: Controller for synchronizing templates from Meta
exports.syncTemplatesFromMetaController = async (req) => {
    return await templateService.syncTemplatesFromMeta(req);
};
