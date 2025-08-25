const templateCategoryService = require("../services/templateCategoryService");

// ✅ Create a new category
exports.createController = async (req) => {
  return await templateCategoryService.createCategory(req);
};

// ✅ Get all categories
exports.getAllController = async (req) => {
  return await templateCategoryService.getAllCategories(req);
};

// ✅ Get category by ID
exports.getByIdController = async (req) => {
  return await templateCategoryService.getCategoryById(req);
};

// ✅ Update category
exports.updateController = async (req) => {
  return await templateCategoryService.updateCategory(req);
};

// ✅ Delete category
exports.deleteController = async (req) => {
  return await templateCategoryService.deleteCategory(req);
};

// ✅ Get templates related to a category
exports.getTemplatesByCategoryController = async (req) => {
  return await templateCategoryService.getTemplatesByCategory(req);
};
