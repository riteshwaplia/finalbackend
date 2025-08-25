const templateService = require("../services/adminTemplateService");

exports.createController = async (req) => {
  return await templateService.createTemplate(req);
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
