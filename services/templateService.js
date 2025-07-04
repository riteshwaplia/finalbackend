// server/services/whatsappService.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Ensure you have installed this: npm install form-data

const BusinessProfile = require('../models/BusinessProfile');
const Project = require('../models/Project');
const { statusCode, resMessage } = require('../config/constants');
const Template = require("../models/Template");

// Helper function to get Meta API credentials from Business Profile
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
            appId: businessProfile.metaAppId, // This is the App ID, not used in uploads but can be useful for other Meta API calls
            wabaId: businessProfile.metaBusinessId, // This is the WABA ID
            facebookUrl: businessProfile.facebookUrl || 'https://graph.facebook.com', // Use default if not set
            graphVersion: businessProfile.graphVersion || 'v19.0', // Use default if not set
        };
    } catch (error) {
        console.error("Error fetching Meta API credentials:", error);
        return { success: false, message: error.message || resMessage.Server_error };
    }
};

/**
 * Helper function to clean template components before sending to Meta API.
 * Specifically removes the 'mediaHandle' property from components as Meta does not expect it
 * in the template definition payload. Also ensures 'format' is not on individual 'parameters'.
 * @param {Array} components - The template components array.
 * @returns {Array} A deep copy of the components array with 'mediaHandle' and 'format' from parameters removed.
 */
const cleanComponentsForMeta = (components) => {
    if (!components) return [];
    const cleaned = JSON.parse(JSON.stringify(components)); // Deep copy

    cleaned.forEach(component => {
        // Remove mediaHandle - this is for local tracking, not for Meta template submission
        if (component.mediaHandle !== undefined) {
            delete component.mediaHandle;
        }

        // Ensure 'format' is not on individual 'parameters' within components
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


// @desc    Upload media (image, document, video) to Meta Graph API using resumable upload
//          This uses the WABA ID in the URL for the /uploads endpoint.
// @route   POST /api/whatsapp/upload-media
// @access  Private (User/Project Owner)
exports.uploadMedia = async (req) => {
  const { projectId, businessProfileId } = req.body; // Expect businessProfileId here for credentials
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
    // 🔍 Step 1: Get Meta API credentials from Business Profile
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

    const { accessToken, wabaId, facebookUrl, graphVersion,appId } = metaCredentials; // wabaId will be used as 'APP_ID' for /uploads
    const filePath = file.path;
    const fileSize = file.size;
    const mimeType = file.mimetype;

    console.log("🟡 Resumable Upload params:", {
      facebookUrl,
      graphVersion,
      appIdUsedForUploads: wabaId, // Logging WABA ID as the 'APP_ID' in this context
      accessToken: !!accessToken,
      mimeType,
      fileSize,
    });

    // Step 2: Initialize the upload session (POST /{APP_ID}/uploads)
    const initUrl = `${facebookUrl}/${graphVersion}/${appId}/uploads`; // Using WABA ID for /uploads endpoint
    console.log("Resumable Upload Init URL:", initUrl);

    const initResponse = await axios.post(
      initUrl,
      {
        file_length: fileSize,
        file_type: mimeType,
        messaging_product: 'whatsapp', // Required by Meta for WhatsApp-related uploads
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("✅ Init upload session response:", initResponse.data);

    const uploadId = initResponse.data?.id; // This is the upload session ID
    if (!uploadId) {
      throw new Error("Upload session ID not received from Meta during initialization.");
    }

    // Step 3: Upload the actual file using the session ID (POST /{upload_session_id})
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: file.originalname,
      contentType: mimeType,
    });
    form.append("type", mimeType); // Meta API documentation sometimes shows this on the second step as well

    const uploadUrl = `${facebookUrl}/${graphVersion}/${uploadId}`;
    console.log("Resumable Upload File URL:", uploadUrl);

    const uploadResponse = await axios.post(
      uploadUrl,
      form,
      {
        headers: {
          ...form.getHeaders(), // CRITICAL for multipart/form-data
          Authorization: `Bearer ${accessToken}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ Media uploaded to Meta:", uploadResponse.data);

    // The 'h' value (handle) is returned here for resumable uploads
    const hValue = uploadResponse.data?.h;
    if (!hValue) {
      throw new Error("Media handle ('h' value) not returned from Meta after resumable upload.");
    }

    // Cleanup: Delete the local temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Media_uploaded,
      data: {
        id: hValue, // Return the 'h' handle as 'id' for consistency with frontend expectation
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

// @desc    Create a new template (locally first)
// @access  Private (User/Team Member)
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
    // 1. Validate business profile locally
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

    // 2. Check for duplicate template name/language locally BEFORE sending to Meta
    // This prevents unnecessary Meta API calls for known duplicates
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

    // 3. Get Meta API credentials for the business profile
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

    // 4. Clean components for Meta API submission (remove local-only fields like mediaHandle)
    const componentsForMeta = cleanComponentsForMeta(components);

    // 5. Prepare payload for Meta API
    const metaPayload = {
      name: name,
      category: category,
      language: language,
      components: componentsForMeta,
    };

    console.log("Attempting to create template on Meta API with payload:", JSON.stringify(metaPayload, null, 2));

    // 6. Send request to Meta API to create the template
    const metaResponse = await axios.post(metaApiUrl, metaPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Meta API response for template creation:", metaResponse.data);

    // 7. Save template details to local database after successful Meta creation
    const newTemplate = await Template.create({
      name,
      category,
      language,
      components: components || [], // Store original components (including mediaHandle) locally
      tenantId,
      userId,
      businessProfileId,
      metaTemplateId: metaResponse.data.id, // Meta's template ID
      metaStatus: metaResponse.data.status, // Meta's status (e.g., PENDING, APPROVED)
      metaCategory: metaResponse.data.category, // Meta's category
      isSynced: true, // Mark as synced
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

// @desc    Submit a template to Meta for approval
// @access  Private (User/Team Member)
exports.submitTemplateToMeta = async (req) => {
  const templateId = req.params.id; // Local template ID
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

    // CRITICAL FIX: Clean components before sending to Meta
    // This removes 'mediaHandle' and 'format' from parameters.
    const componentsForMeta = cleanComponentsForMeta(template.components);

    const payload = {
      name: template.name,
      category: template.category,
      language: template.language,
      components: componentsForMeta, // Use cleaned components for Meta API
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

// @desc    Get all templates for the authenticated user, optionally filtered by businessProfileId
// @access  Private (User/Team Member)
exports.getAllTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId } = req.query; // Allow filtering by businessProfileId

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

// @desc    Get a single template by ID
// @access  Private (User/Team Member)
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

// @desc    Update a template
// @access  Private (User/Team Member)
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

// @desc    Delete a template
// @access  Private (User/Team Member)
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

// NEW: @desc    Synchronize templates from Meta API for the current user's specified business profile
// @access  Private (User/Team Member)
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

    for (const metaTemplate of metaTemplates) {
      let existingTemplate = await Template.findOne({
        metaTemplateId: metaTemplate.id,
        tenantId,
        userId,
        businessProfileId,
      });

      if (existingTemplate) {
        existingTemplate.name = metaTemplate.name;
        existingTemplate.category = metaTemplate.category;
        existingTemplate.language = metaTemplate.language;
        existingTemplate.components = metaTemplate.components;
        existingTemplate.metaStatus = metaTemplate.status;
        existingTemplate.isSynced = true;
        existingTemplate.lastSyncedAt = new Date();
        existingTemplate.metaCategory = metaTemplate.category;
        await existingTemplate.save();
        updatedCount++;
      } else {
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
      }
    }

    return {
      status: statusCode.OK,
      success: true,
      message: `Templates synchronized successfully. Added: ${addedCount}, Updated: ${updatedCount}.`,
      data: { addedCount, updatedCount },
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




