// server/services/whatsappService.js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const BusinessProfile = require('../models/BusinessProfile');
const { statusCode, resMessage } = require('../config/constants');
const Template = require("../models/Template");
const { createAuthTemplate } = require("../functions/functions")

const getBusinessProfileMetaApiCredentials = async (businessProfileId, userId, tenantId) => {
    try {
        const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
        if (!businessProfile) {
            return { success: false, message: "Business profile not found or unauthorized." };
        }
        if (!businessProfile.metaAccessToken || !businessProfile.metaBusinessId) {
            return { success: false, message: resMessage.Meta_API_credentials_not_configured + " for Business Profile. Please ensure Access Token and WABA ID are set." };
        }
        return {
            success: true,
            accessToken: businessProfile.metaAccessToken,
            appId: businessProfile.metaAppId,
            wabaId: businessProfile.metaBusinessId,
            facebookUrl: businessProfile.facebookUrl || 'https://graph.facebook.com',
            graphVersion: businessProfile.graphVersion || 'v19.0',
        };
    } catch (error) {
        console.error("Error fetching Meta API credentials:", error);
        return { success: false, message: error.message || resMessage.Server_error };
    }
};

const cleanComponentsForMeta = (components) => {
    if (!components) return [];
    const cleaned = JSON.parse(JSON.stringify(components));

    cleaned.forEach(component => {
        if (component.mediaHandle !== undefined) {
            delete component.mediaHandle;
        }

        if (component.parameters && Array.isArray(component.parameters)) {
            component.parameters.forEach(param => {
                if (param.format !== undefined) {
                    delete param.format;
                }
            });
        }
    });
    return cleaned;
};

exports.uploadMedia = async (req) => {
  const { projectId, businessProfileId } = req.body; 
  const file = req.file;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!file) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Media_required,
    };
  }
  if (!projectId || !businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Missing_required_fields + " (projectId and businessProfileId are required).",
    };
  }

  try {
    const metaCredentials = await getBusinessProfileMetaApiCredentials(
      businessProfileId,
      userId,
      tenantId
    );
    if (!metaCredentials.success) {
      console.warn("Meta credential fetch failed:", metaCredentials.message);
      return {
        status: metaCredentials.status || statusCode.BAD_REQUEST,
        success: false,
        message: metaCredentials.message,
      };
    }

    const { accessToken, wabaId, facebookUrl, graphVersion,appId } = metaCredentials;
    const filePath = file.path;
    const fileSize = file.size;
    const mimeType = file.mimetype;

    console.log("🟡 Resumable Upload params:", {
      facebookUrl,
      graphVersion,
      appIdUsedForUploads: wabaId,
      accessToken: !!accessToken,
      mimeType,
      fileSize,
    });

    const initUrl = `${facebookUrl}/${graphVersion}/${appId}/uploads`; 
    console.log("Resumable Upload Init URL:", initUrl);

    const initResponse = await axios.post(
      initUrl,
      {
        file_length: fileSize,
        file_type: mimeType,
        messaging_product: 'whatsapp',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("✅ Init upload session response:", initResponse.data);

    const uploadId = initResponse.data?.id; 
    if (!uploadId) {
      throw new Error("Upload session ID not received from Meta during initialization.");
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: file.originalname,
      contentType: mimeType,
    });
    form.append("type", mimeType);

    const uploadUrl = `${facebookUrl}/${graphVersion}/${uploadId}`;
    console.log("Resumable Upload File URL:", uploadUrl);

    const uploadResponse = await axios.post(
      uploadUrl,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ Media uploaded to Meta:", uploadResponse.data);

    const hValue = uploadResponse.data?.h;
    if (!hValue) {
      throw new Error("Media handle ('h' value) not returned from Meta after resumable upload.");
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Media_uploaded,
      data: {
        id: hValue, 
        mimeType,
        fileSize,
      },
    };
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const metaError = error.response?.data?.error || error.message;
    console.error("❌ Resumable Media upload error:", metaError);
    console.error("❌ Full error response:", JSON.stringify(error.response?.data || {}));

    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Media upload failed: ${metaError.message || metaError}`,
      metaError: error.response?.data || null,
    };
  }
};

exports.createTemplate = async (req) => {
  const { name, category, language, components, businessProfileId } = req.body;
  const tenantId = req.tenant._id;
  const userId = req.user._id;

  if (!name || !language || !businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (name, language, and businessProfileId are required).",
    };
  }

  try {
    const businessProfile = await BusinessProfile.findOne({
      _id: businessProfileId,
      userId,
      tenantId,
    });
    if (!businessProfile) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message:
          "Selected Business Profile not found or does not belong to your account.",
      };
    }

    const templateExistsLocally = await Template.findOne({
      name,
      language,
      tenantId,
      userId,
      businessProfileId,
    });
    if (templateExistsLocally) {
      return {
        status: statusCode.CONFLICT,
        success: false,
        message:
          "Template with this name and language already exists locally for this business profile. Please use a different name or language.",
      };
    }

    const metaCredentials = await getBusinessProfileMetaApiCredentials(
      businessProfileId,
      userId,
      tenantId
    );
    if (!metaCredentials.success) {
      return {
        status: metaCredentials.status || statusCode.BAD_REQUEST,
        success: false,
        message: metaCredentials.message,
      };
    }

    const { accessToken, wabaId, facebookUrl, graphVersion } = metaCredentials;
    const metaApiUrl = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates`;

    const componentsForMeta = cleanComponentsForMeta(components);

    const metaPayload = {
      name: name,
      category: category,
      language: language,
      components: componentsForMeta,
    };

    console.log("Attempting to create template on Meta API with payload:", JSON.stringify(metaPayload, null, 2));

    const metaResponse = await axios.post(metaApiUrl, metaPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Meta API response for template creation:", metaResponse.data);

    const newTemplate = await Template.create({
      name,
      category,
      language,
      components: components || [], 
      tenantId,
      userId,
      businessProfileId,
      metaTemplateId: metaResponse.data.id,
      metaStatus: metaResponse.data.status,
      metaCategory: metaResponse.data.category,
      isSynced: true,
      lastSyncedAt: new Date(),
    });

    return {
      status: statusCode.CREATED,
      success: true,
      message: resMessage.Template_submitted + " to Meta for approval and saved locally.",
      data: newTemplate,
    };
  } catch (error) {
    console.error("Error creating template (Meta API or DB save):", error.response?.data || error.message);
    const metaError = error.response?.data?.error?.message || error.message;
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to create template: ${metaError}. Please check Meta API response for details.`,
      metaError: error.response?.data || null,
    };
  }
};

exports.submitTemplateToMeta = async (req) => {
  const templateId = req.params.id;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const { businessProfileId } = req.body;

  if (!businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (businessProfileId is required).",
    };
  }

  try {
    const template = await Template.findOne({
      _id: templateId,
      userId,
      tenantId,
      businessProfileId,
    });
    if (!template) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.No_data_found,
      };
    }

    const metaCredentials = await getBusinessProfileMetaApiCredentials(
      businessProfileId,
      userId,
      tenantId
    );
    if (!metaCredentials.success) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: metaCredentials.message,
      };
    }

    const { accessToken, wabaId, facebookUrl, graphVersion } = metaCredentials;

    const url = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates`;

    const componentsForMeta = cleanComponentsForMeta(template.components);

    const payload = {
      name: template.name,
      category: template.category,
      language: template.language,
      components: componentsForMeta,
    };

    console.log("Payload sent to Meta for template submission:", JSON.stringify(payload, null, 2));


    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    template.metaTemplateId = response.data.id;
    template.metaStatus = response.data.status;
    template.isSynced = true;
    template.lastSyncedAt = new Date();
    template.metaCategory = response.data.category;
    await template.save();

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Template_submitted + " to Meta for approval.",
      data: template,
    };
  } catch (error) {
    console.error(
      "Error submitting template to Meta:",
      error.response?.data || error.message
    );
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to submit template to Meta: ${
        error.response?.data?.error?.message || error.message
      }`,
    };
  }
};

exports.getAllTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId } = req.query;
  let query = { tenantId, userId };
  if (businessProfileId) {
    query.businessProfileId = businessProfileId;
  }

  try {
    const templates = await Template.find(query).lean();
    if (templates.length === 0) {
      return {
        status: statusCode.OK,
        success: true,
        message:
          resMessage.No_data_found +
          (businessProfileId ? " for the selected business profile." : ""),
        data: [],
      };
    }
    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Template_fetched,
      data: templates,
    };
  } catch (error) {
    console.error("Error fetching templates:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

exports.getTemplateById = async (req) => {
  const templateId = req.params.id;
  const tenantId = req.tenant._id;
  const userId = req.user._id;

  try {
    const template = await Template.findOne({
      _id: templateId,
      tenantId,
      userId,
    }).lean();
    if (!template) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.No_data_found,
      };
    }
    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.template_view_successfully,
      data: template,
    };
  } catch (error) {
    console.error("Error fetching template by ID:", error);
    if (error.name === "CastError") {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Invalid Template ID format.",
      };
    }
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

exports.updateTemplate = async (req) => {
  const templateId = req.params.id;
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { name, category, language, components, businessProfileId } = req.body;

  if (!businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (businessProfileId is required for update).",
    };
  }

  try {
    const template = await Template.findOne({
      _id: templateId,
      tenantId,
      userId,
      businessProfileId,
    });
    if (!template) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.No_data_found,
      };
    }

    if (
      template.isSynced &&
      template.metaStatus === "APPROVED" &&
      (name !== template.name || language !== template.language)
    ) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message:
          "Cannot change name or language of an approved template. Please create a new template.",
      };
    }
    if (name && name !== template.name) {
      const nameConflict = await Template.findOne({
        name,
        language: template.language,
        tenantId,
        userId,
        businessProfileId,
        _id: { $ne: templateId },
      });
      if (nameConflict) {
        return {
          status: statusCode.CONFLICT,
          success: false,
          message:
            "Template with this name and language already exists for this business profile.",
        };
      }
    }

    template.name = name || template.name;
    template.category = category !== undefined ? category : template.category;
    template.language = language || template.language;
    template.components =
      components !== undefined ? components : template.components;
    if (template.isSynced && template.metaStatus === "APPROVED") {
      template.metaStatus = "PENDING_UPDATE";
      template.isSynced = false;
    }

    await template.save();

    return {
      status: statusCode.OK,
      success: true,
      message: "Template updated successfully.",
      data: template,
    };
  } catch (error) {
    console.error("Error updating template:", error);
    if (error.name === "CastError") {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Invalid Template ID format.",
      };
    }
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

exports.deleteTemplate = async (req) => {
  const templateId = req.params.id;
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId } = req.body;

  try {
    const template = await Template.findOne({
      _id: templateId,
      tenantId,
      userId,
      businessProfileId,
    });
    if (!template) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.No_data_found,
      };
    }

    await template.deleteOne();

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Template_deleted_successfully,
    };
  } catch (error) {
    console.error("Error deleting template:", error);
    if (error.name === "CastError") {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Invalid Template ID format.",
      };
    }
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

exports.syncTemplatesFromMeta = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const { businessProfileId } = req.body;

  if (!businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (businessProfileId is required for sync).",
    };
  }

  try {
    const metaCredentials = await getBusinessProfileMetaApiCredentials(
      businessProfileId,
      userId,
      tenantId
    );
    if (!metaCredentials.success) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: metaCredentials.message,
      };
    }

    const { accessToken, wabaId, facebookUrl, graphVersion } = metaCredentials;
    const url = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const metaTemplates = response.data.data;
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const metaTemplate of metaTemplates) {
      const filter = {
        $or: [
          { metaTemplateId: metaTemplate.id },
          {
            name: metaTemplate.name,
            language: metaTemplate.language,
            businessProfileId,
          },
        ],
      };

      const existingTemplate = await Template.findOne(filter);

      if (existingTemplate) {
        existingTemplate.name = metaTemplate.name;
        existingTemplate.category = metaTemplate.category;
        existingTemplate.language = metaTemplate.language;
        existingTemplate.components = metaTemplate.components;
        existingTemplate.metaTemplateId = metaTemplate.id;
        existingTemplate.metaStatus = metaTemplate.status;
        existingTemplate.metaCategory = metaTemplate.category;
        existingTemplate.isSynced = true;
        existingTemplate.lastSyncedAt = new Date();
        await existingTemplate.save();
        updatedCount++;
      } else {
        try {
          await Template.create({
            tenantId,
            userId,
            businessProfileId,
            name: metaTemplate.name,
            category: metaTemplate.category,
            language: metaTemplate.language,
            components: metaTemplate.components,
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            metaCategory: metaTemplate.category,
            isSynced: true,
            lastSyncedAt: new Date(),
          });
          addedCount++;
        } catch (err) {
          if (err.code === 11000) {
            console.warn(
              `Duplicate template skipped: ${metaTemplate.name} (${metaTemplate.language})`
            );
            skippedCount++;
          } else {
            throw err;
          }
        }
      }
    }

    return {
      status: statusCode.OK,
      success: true,
      message: `Templates synchronized successfully. Added: ${addedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}.`,
      data: { addedCount, updatedCount, skippedCount },
    };
  } catch (error) {
    console.error(
      "Error synchronizing templates from Meta:",
      error.response?.data || error.message
    );
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to synchronize templates from Meta: ${
        error.response?.data?.error?.message || error.message
      }. Ensure your selected business profile has correct WABA ID and Access Token.`,
    };
  }
};

exports.authTemplate = async (req) => {
  try {
    const { templateName, language, otp_type, businessProfileId } = req.body;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    const businessProfile = await BusinessProfile.findOne({
      _id: businessProfileId,
      userId,
      tenantId,
    });
    
     const metaCredentials = await getBusinessProfileMetaApiCredentials(
      businessProfileId,
      userId,
      tenantId
    );

    if (!businessProfile) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Business_profile_not_found,
        statusCode: statusCode.NOT_FOUND,
      };
    }
    const {accessToken, wabaId} = metaCredentials;

    const templateExistsLocally = await Template.findOne({
      name: templateName,
      language,
      otp_type,
      tenantId,
      userId,
      businessProfileId
    });

    if (templateExistsLocally) {
      return {
        status: statusCode.CONFLICT,
        success: false,
        message: resMessage.Template_already_exists,
        statusCode: statusCode.CONFLICT,
      };
    }

    const result = await createAuthTemplate(templateName, otp_type, language, wabaId, accessToken);

    await Template.create({
      name: templateName,
      category: result?.category,
      language,
      otp_type,
      tenantId,
      userId,
      businessProfileId: businessProfileId,
      metaStatus: result?.status,
    });

    return {
      data: result,
      status: statusCode.OK,
      success: true,
      message: resMessage.Template_submitted + " for authentication.",
    }
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: resMessage.Server_error,
      error: error.message
    };
  }
}