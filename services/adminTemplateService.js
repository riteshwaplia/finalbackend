const AdminTemplate = require("../models/AdminTemplate");
const OccasionCategory = require("../models/TemplateCategorySchema");

exports.createTemplate = async (req) => {
  const { name, language, components, categoryId, tag,type, otp_type,category } = req.body;
  const tenantId = req.user.tenantId;

  const category1 = await OccasionCategory.findOne({ _id: categoryId, tenantId });
  if (!category1) {
    throw new Error("Invalid category selected");
  }

  const exists = await AdminTemplate.findOne({ name, tenantId });
  if (exists) {
    throw new Error("Template with this name already exists");
  }

  const template = await AdminTemplate.create({
    tenantId,
    name,
    category,
    tag,
    language,
    components,
    TemplateCategory: categoryId,
    type: type || "STANDARD",
    otp_type,
  });

  return { success: true, message: "Template created successfully", data: template };
};

exports.getAllTemplates = async (req) => {
  const tenantId = req.user.tenantId;
  const { categoryId } = req.query;

  const query = { tenantId };
  if (categoryId) query.TemplateCategory = categoryId;

  const templates = await AdminTemplate.find(query)
    .populate("TemplateCategory", "name description")
    .sort({ createdAt: -1 });

  return { success: true, message: "Templates fetched successfully", data: templates };
};

exports.getTemplateById = async (req) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  const template = await AdminTemplate.findOne({ _id: id, tenantId }).populate("TemplateCategory", "name description");
  if (!template) throw new Error("Template not found");

  return { success: true, message: "Template fetched successfully", data: template };
};

exports.updateTemplate = async (req) => {
  const { id } = req.params;
  const { name, language, components,tag, categoryId, type, otp_type ,category} = req.body;
  const tenantId = req.user.tenantId;

  const template = await AdminTemplate.findOneAndUpdate(
    { _id: id, tenantId },
    {
      name,
      language,
      components,
    category,
    tag,
      TemplateCategory: categoryId,
      type,
      otp_type,
      updatedAt: Date.now(),
    },
    { new: true }
  );

  if (!template) throw new Error("Template not found");

  return { success: true, message: "Template updated successfully", data: template };
};

exports.deleteTemplate = async (req) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  const template = await AdminTemplate.findOneAndDelete({ _id: id, tenantId });
  if (!template) throw new Error("Template not found");

  return { success: true, message: "Template deleted successfully" };
};
