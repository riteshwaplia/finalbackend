const OccasionCategory = require("../models/TemplateCategorySchema"); // your category model
const AdminTemplate = require("../models/AdminTemplate");

// ✅ Create a new category
exports.createCategory = async (req) => {
  const { name, description,icons } = req.body;
  const tenantId = req.user.tenantId; // assuming auth middleware adds this

  // check if already exists
  const exists = await OccasionCategory.findOne({ name, tenantId });
  if (exists) {
    throw new Error("Category already exists");
  }

  const category = await OccasionCategory.create({
    tenantId,
    name,
    icons,
    description,
  });

  return { success: true, message: "Category created successfully", data: category };
};

// ✅ Get all categories (for a tenant)
exports.getAllCategories = async (req) => {
  const tenantId = req.user.tenantId;
  const categories = await OccasionCategory.find({ tenantId, isActive: true }).sort({ createdAt: -1 });

  return { success: true, message: "Categories fetched successfully", data: categories };
};

// ✅ Get category by ID
exports.getCategoryById = async (req) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  const category = await OccasionCategory.findOne({ _id: id, tenantId });
  if (!category) throw new Error("Category not found");

  return { success: true, message: "Category fetched successfully", data: category };
};

// ✅ Update category
exports.updateCategory = async (req) => {
  const { id } = req.params;
  const { name, description, isActive ,icons} = req.body;
  const tenantId = req.user.tenantId;

  const category = await OccasionCategory.findOneAndUpdate(
    { _id: id, tenantId },
    { name, description, isActive,icons, updatedAt: Date.now() },
    { new: true }
  );

  if (!category) throw new Error("Category not found");

  return { success: true, message: "Category updated successfully", data: category };
};

// ✅ Delete category (soft delete by isActive = false or hard delete)
// exports.deleteCategory = async (req) => {
//   const { id } = req.params;
//   const tenantId = req.user.tenantId;

//   const category = await OccasionCategory.findOneAndDelete({ _id: id, tenantId });
//   if (!category) throw new Error("Category not found");

//   return { success: true, message: "Category deleted successfully" };
// };
exports.deleteCategory = async (req) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // First find the category
  const category = await OccasionCategory.findOne({ _id: id, tenantId });
  if (!category) throw new Error("Category not found");

  // Delete all templates linked to this category
  await AdminTemplate.deleteMany({ tenantId, TemplateCategory: id });

  // Delete the category itself
  await OccasionCategory.findOneAndDelete({ _id: id, tenantId });

  return { 
    success: true, 
    message: "Category and related templates deleted successfully" 
  };
};
// ✅ Get templates related to a category
exports.getTemplatesByCategory = async (req) => {
  const { categoryId } = req.params; // categoryId
  const tenantId = req.user.tenantId;
console.log("id", categoryId, "tenantId", tenantId);
  const templates = await AdminTemplate.find({
    tenantId,
    TemplateCategory: categoryId,
  })
    .populate("TemplateCategory", "name description")
    .sort({ createdAt: -1 });
console.log("templates", templates);
  return {
    success: true,
    message: "Templates fetched successfully",
    data: templates,
  };
};
