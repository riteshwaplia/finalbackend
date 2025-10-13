// server/services/whatsappService.js
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data"); // Ensure you have installed this: npm install form-data
const mongoose = require('mongoose');
const BusinessProfile = require("../models/BusinessProfile");
const { statusCode, resMessage } = require("../config/constants");
const Template = require("../models/Template");
const facebookUrl = "https://graph.facebook.com";
const graphVersion = "v19.0"; // Use default if not
const { createCatalogTemplate, sendCatalogTemplateMessage } = require('../functions/functions');
const Project = require('../models/Project');

// Helper function to get Meta API credentials from Business Profile
const getBusinessProfileMetaApiCredentials = async (
  businessProfileId,
  userId,
  tenantId
) => {
  try {
    const businessProfile = await BusinessProfile.findOne({
      _id: businessProfileId,
      userId,
      tenantId,
    });
    if (!businessProfile) {
      return {
        success: false,
        message: "Business profile not found or unauthorized.",
      };
    }
    if (!businessProfile.metaAccessToken || !businessProfile.metaBusinessId) {
      return {
        success: false,
        message:
          resMessage.Meta_API_credentials_not_configured +
          " for Business Profile. Please ensure Access Token and WABA ID are set.",
      };
    }
    return {
      success: true,
      accessToken: businessProfile.metaAccessToken,
      appId: businessProfile.metaAppId, // This is the App ID, not used in uploads but can be useful for other Meta API calls
      wabaId: businessProfile.metaBusinessId, // This is the WABA ID
      facebookUrl: businessProfile.facebookUrl || "https://graph.facebook.com", // Use default if not set
      graphVersion: businessProfile.graphVersion || "v19.0", // Use default if not set
    };
  } catch (error) {
    console.error("Error fetching Meta API credentials:", error);
    return {
      success: false,
      message: error.message || resMessage.Server_error,
    };
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

  cleaned.forEach((component) => {
    // Remove mediaHandle - this is for local tracking, not for Meta template submission
    if (component.mediaHandle !== undefined) {
      delete component.mediaHandle;
    }

    // Ensure 'format' is not on individual 'parameters' within components
    if (component.parameters && Array.isArray(component.parameters)) {
      component.parameters.forEach((param) => {
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
      message:
        resMessage.Missing_required_fields +
        " (projectId and businessProfileId are required).",
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

    const { accessToken, wabaId, facebookUrl, graphVersion, appId } =
      metaCredentials; // wabaId will be used as 'APP_ID' for /uploads
    const filePath = file.path;
    const fileSize = file.size;
    const mimeType = file.mimetype;
    // console.log(first)
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
        messaging_product: "whatsapp", // Required by Meta for WhatsApp-related uploads
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Init upload session response:", initResponse.data);

    const uploadId = initResponse.data?.id; // This is the upload session ID
    if (!uploadId) {
      throw new Error(
        "Upload session ID not received from Meta during initialization."
      );
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

    const uploadResponse = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(), // CRITICAL for multipart/form-data
        Authorization: `Bearer ${accessToken}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log("✅ Media uploaded to Meta:", uploadResponse.data);

    // The 'h' value (handle) is returned here for resumable uploads
    const hValue = uploadResponse.data?.h;
    if (!hValue) {
      throw new Error(
        "Media handle ('h' value) not returned from Meta after resumable upload."
      );
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
    console.error(
      "❌ Full error response:",
      JSON.stringify(error.response?.data || {})
    );

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
  const { name, category, language, components, businessProfileId, projectId } = req.body;
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

    console.log(
      "Attempting to create template on Meta API with payload:",
      JSON.stringify(metaPayload, null, 2)
    );

    // 6. Send request to Meta API to create the template
    const metaResponse = await axios.post(metaApiUrl, metaPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Meta API response for template creation:", metaResponse.data);

    // FIX: Determine template type correctly based on Meta's definitions
    // Meta does not have a "TEMPLATE" type, only "STANDARD" or "CAROUSEL"
    const templateType = components?.some(c => c.type === "CAROUSEL") ? "CAROUSEL" : "STANDARD"; // Corrected this line

    // 8. Save template details to local database after successful Meta creation
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
      type: templateType
    });

    return {
      status: statusCode.CREATED,
      success: true,
      message:
        resMessage.Template_submitted +
        " to Meta for approval and saved locally.",
      data: newTemplate,
    };
  } catch (error) {
    console.error(
      "Error creating template (Meta API or DB save):",
      error.response?.data || error.message
    );
    const metaError = error.response?.data?.error?.message || error.message;
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to create template: ${metaError}. Please check Meta API response for details.`,
      metaError: error.response?.data || null,
    };
  }
};



exports.createCarouselTemplate = async (req) => {
  const { name, language, category, components, businessProfileId, projectId } =
    req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (
    !name ||
    !language ||
    !category ||
    !components ||
    !businessProfileId ||
    !projectId
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (name, language, category, components, businessProfileId, projectId are required for carousel template).",
    };
  }

  const carouselComponent = components.find((comp) => comp.type === "CAROUSEL");
  if (
    !carouselComponent ||
    !carouselComponent.cards ||
    carouselComponent.cards.length === 0
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        "Carousel template must have a 'CAROUSEL' component with at least one card.",
    };
  }

  if (carouselComponent.cards.length > 10) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Carousel_limit_exceed,
      statusCode: statusCode.BAD_REQUEST
    }
  }

  try {
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

    const { accessToken, wabaId } = metaCredentials;
    const url = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates`;

    const payload = {
      name,
      language,
      category,
      components: components,
    };

    console.log(
      "Sending carousel template creation request to Meta:",
      JSON.stringify(payload, null, 2)
    );

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Meta API carousel template creation response:", response.data);

    const newTemplate = await Template.create({
      name,
      category,
      language,
      components: components || [],
      tenantId,
      userId,
      businessProfileId,
      metaTemplateId: response.data.id,
      metaStatus: response.data.status,
      metaCategory: response.data.category,
      isSynced: true,
      lastSyncedAt: new Date(),
      type: "CAROUSEL",
    });

    return {
      status: statusCode.CREATED,
      success: true,
      message: resMessage.Template_submitted + " (Carousel)",
      data: newTemplate,
    };
  } catch (error) {
    console.error(
      "Error creating carousel template on Meta:",
      error.response?.data || error.message
    );
    return {
      status: error.response?.status || statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to create carousel template: ${error.response?.data?.error?.message || error.message
        }`,
      metaError: error.response?.data?.error || null,
    };
  }
};

// @desc    Create a new template with a FLOW button (locally first, then submit to Meta)
// @access  Private (User/Team Member)
exports.createTemplateWithFlow = async (req) => {
  const { name, language, category = 'MARKETING', components, businessProfileId } = req.body;
  const tenantId = req.tenant._id;
  const userId = req.user._id;

  if (!name || !language || !businessProfileId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Missing_required_fields + ' (name, language, businessProfileId required).',
    };
  }

  if (!components || !Array.isArray(components)) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: 'components array is required and must contain a BUTTONS component with FLOW button.',
    };
  }

  try {
    // 1. Validate business profile
    const businessProfile = await BusinessProfile.findOne({
      _id: businessProfileId,
      userId,
      tenantId,
    });
    if (!businessProfile) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: 'Selected Business Profile not found or does not belong to your account.',
      };
    }

    // 2. Check for local duplicate template
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
        message: 'Template with this name and language already exists locally for this business profile.',
      };
    }

    // 3. Get Meta API credentials
    const metaCredentials = await getBusinessProfileMetaApiCredentials(businessProfileId, userId, tenantId);
    if (!metaCredentials.success) {
      return {
        status: metaCredentials.status || statusCode.BAD_REQUEST,
        success: false,
        message: metaCredentials.message,
      };
    }

    const { accessToken, wabaId, facebookUrl, graphVersion } = metaCredentials;

    // 4. Validate FLOW button exists in components
    const buttonsComponent = components.find(c => String(c.type).toUpperCase() === 'BUTTONS');
    if (!buttonsComponent || !Array.isArray(buttonsComponent.buttons) || buttonsComponent.buttons.length === 0) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: 'Please include a BUTTONS component with a FLOW button.',
      };
    }

    const flowButton = buttonsComponent.buttons.find(b => String(b.type).toUpperCase() === 'FLOW');
    if (!flowButton) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: 'No FLOW button found in BUTTONS component.',
      };
    }

    // 5. Ensure flow is published on Meta
    const { flow_id, flow_name, flow_json } = flowButton;
    const flowCheck = await functions.ensureFlowPublished(accessToken, businessProfileId, { flow_id, flow_name });
    if (!flowCheck.ok) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: `Flow validation failed: ${flowCheck.message}`,
      };
    }

    // 6. Prepare components for Meta API
    const componentsForMeta = (components || []).map(comp => {
      const type = String(comp.type || '').toUpperCase();

      if (type === 'BUTTONS') {
        const buttons = (comp.buttons || []).map(btn => {
          if (String(btn.type).toUpperCase() === 'FLOW') {
            const button = { type: 'FLOW', text: btn.text || 'Open flow' };
            if (flow_id) button.flow_id = String(flow_id);
            else if (flow_name) button.flow_name = String(flow_name);
            else if (flow_json) button.flow_json = typeof flow_json === 'string' ? flow_json : JSON.stringify(flow_json);
            return button;
          }
          return { ...btn, type: String(btn.type || '').toUpperCase() };
        });
        return { type: 'BUTTONS', buttons };
      }

      if (type === 'BODY') {
        const { text, example } = comp;
        const body = {};
        if (text) body.text = text;
        if (example) body.example = example;
        return { type: 'BODY', ...body };
      }

      if (type === 'HEADER') return { type: 'HEADER', ...comp };
      if (type === 'FOOTER') return { type: 'FOOTER', ...comp };

      return { ...comp, type: type || comp.type };
    });

    // 7. Send template to Meta API
    const metaUrl = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates`;
    const payload = { name, language, category, components: componentsForMeta };

    console.log('Creating template with FLOW on Meta:', JSON.stringify(payload, null, 2));

    const response = await axios.post(metaUrl, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    // 8. Determine template type
    const templateType = components?.some(c => String((c.type || '')).toUpperCase() === 'CAROUSEL') ? 'CAROUSEL' : 'STANDARD';

    // 9. Save template locally
    const newTemplate = await Template.create({
      name,
      category,
      language,
      components: components || [],
      tenantId,
      userId,
      businessProfileId,
      metaTemplateId: response.data.id,
      metaStatus: response.data.status || 'PENDING_REVIEW',
      metaCategory: response.data.category || category,
      isSynced: true,
      lastSyncedAt: new Date(),
      type: templateType
    });

    return {
      status: statusCode.CREATED,
      success: true,
      message: resMessage.Template_submitted + ' to Meta for approval and saved locally.',
      data: newTemplate,
      metaResponse: response.data
    };
  } catch (error) {
    console.error('Error in createTemplateWithFlow:', error.response?.data || error.message);
    const metaError = error.response?.data?.error?.message || error.message;
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: `Failed to create template with flow: ${metaError}`,
      metaError: error.response?.data || null
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

    console.log(
      "Payload sent to Meta for template submission:",
      JSON.stringify(payload, null, 2)
    );

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
      message: `Failed to submit template to Meta: ${error.response?.data?.error?.message || error.message
        }`,
    };
  }
};

exports.getAllTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId, page = 1, limit = 10, type } = req.query;

  const query = { tenantId, userId };
  if (businessProfileId) {
    query.businessProfileId = businessProfileId;
  }

  if (type === "carousel") {
    query['components.type'] = "CAROUSEL"
  }
  else if (type === "regular") {
    query['components.type'] = { $ne: "CAROUSEL" };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [templates, totalCount] = await Promise.all([
      Template.find(query).skip(skip).limit(parseInt(limit)).lean(),
      Template.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    console.log(
      `Fetched ${templates.length} templates for page ${page} of ${totalPages}`
    );
    if (templates.length === 0) {
      return {
        status: statusCode.OK,
        success: true,
        message:
          resMessage.No_data_found +
          (businessProfileId ? " for the selected business profile." : ""),
        data: [],
        pagination: {
          totalCount,
          totalPages,
          currentPage: parseInt(page),
        },
      };
    }

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Template_fetched,
      data: templates,
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
      },
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

exports.getAllApprovedTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId, page = 1, limit = 100 } = req.query;

  const query = {
    tenantId,
    userId,
    metaStatus: 'APPROVED',
    components: {
      $not: {
        $elemMatch: {
          type: "CAROUSEL"
        }
      }
    }
  };

  if (businessProfileId) {
    query.businessProfileId = businessProfileId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [templates, totalCount] = await Promise.all([
      Template.find(query).skip(skip).limit(parseInt(limit)).lean(),
      Template.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      status: 200,
      success: true,
      message:
        templates.length === 0
          ? 'No approved templates found' +
          (businessProfileId ? ' for the selected business profile.' : '')
          : 'Templates fetched successfully',
      data: templates,
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
      },
    };
  } catch (error) {
    console.error('Error fetching templates:', error);
    return {
      status: 500,
      success: false,
      message: error.message || 'Internal server error',
    };
  }
};

exports.getAllCarouselTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId, page = 1, limit = 100 } = req.query;

  const query = {
    tenantId,
    userId,
    components: {
      $elemMatch: {
        type: "CAROUSEL"
      }
    },
    metaStatus: 'APPROVED',
  };

  if (businessProfileId) {
    query.businessProfileId = businessProfileId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [templates, totalCount] = await Promise.all([
      Template.find(query).skip(skip).limit(parseInt(limit)).lean(),
      Template.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      status: 200,
      success: true,
      message:
        templates.length === 0
          ? 'No carousel templates found' +
          (businessProfileId ? ' for the selected business profile.' : '')
          : 'Carousel templates fetched successfully',
      data: templates,
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
      },
    };
  } catch (error) {
    console.error('Error fetching carousel templates:', error);
    return {
      status: 500,
      success: false,
      message: error.message || 'Internal server error',
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

exports.getAllCatalogTemplates = async (req) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { businessProfileId, page = 1, limit = 100 } = req.query;

  // ✅ Make businessProfileId mandatory
  if (!businessProfileId) {
    return {
      status: 400,
      success: false,
      message: "Missing businessProfileId in request"
    };
  }

  const baseMatch = {
    tenantId,
    userId,
    businessProfileId: new mongoose.Types.ObjectId(businessProfileId),
    metaStatus: 'APPROVED',
    components: {
      $not: {
        $elemMatch: {
          type: "CAROUSEL"
        }
      }
    }
  };

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 100, 1);
  const skip = (pageNum - 1) * limitNum;

  try {
    const basePipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          buttonTypes: {
            $reduce: {
              input: "$components",
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $cond: [
                      { $isArray: "$$this.buttons" },
                      { $map: { input: "$$this.buttons", as: "b", in: { $toUpper: "$$b.type" } } },
                      []
                    ]
                  }
                ]
              }
            }
          },
          headerFormats: {
            $map: {
              input: {
                $filter: {
                  input: "$components",
                  as: "c",
                  cond: { $eq: ["$$c.type", "HEADER"] }
                }
              },
              as: "h",
              in: { $toUpper: "$$h.format" }
            }
          }
        }
      },
      {
        $addFields: {
          catalogType: {
            $switch: {
              branches: [
                { case: { $in: ["SPM", "$buttonTypes"] }, then: "SPM" },
                { case: { $in: ["PRODUCT", "$headerFormats"] }, then: "SPM" },
                { case: { $in: ["MPM", "$buttonTypes"] }, then: "MPM" },
                { case: { $in: ["CATALOG", "$buttonTypes"] }, then: "CATALOG_SIMPLE" }
              ],
              default: "NOT_CATALOG"
            }
          }
        }
      },
      { $match: { catalogType: { $in: ["SPM", "MPM", "CATALOG_SIMPLE"] } } }
    ];

    const countsPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: "$catalogType",
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          counts: { $push: { k: "$_id", v: "$count" } },
          total: { $sum: "$count" }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          counts: { $arrayToObject: "$counts" }
        }
      }
    ];

    const countsResult = await Template.aggregate(countsPipeline);
    const countsObj = (countsResult && countsResult[0]) || { total: 0, counts: {} };

    const docsPipeline = [
      ...basePipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          name: 1,
          catalogType: 1,
          components: 1
        }
      }
    ];

    const docs = await Template.aggregate(docsPipeline);

    const spm = [];
    const mpm = [];
    const simple = [];

    docs.forEach(d => {
      if (d.catalogType === 'SPM') spm.push(d);
      else if (d.catalogType === 'MPM') mpm.push(d);
      else if (d.catalogType === 'CATALOG_SIMPLE') simple.push(d);
    });

    const totalCount = countsObj.total || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    const message =
      totalCount === 0
        ? 'No catalog templates found for the selected business profile.'
        : 'Catalog templates fetched successfully';

    return {
      status: 200,
      success: true,
      message,
      data: { spm, mpm, simple },
      counts: {
        total: totalCount,
        byType: {
          SPM: countsObj.counts?.SPM || 0,
          MPM: countsObj.counts?.MPM || 0,
          CATALOG_SIMPLE: countsObj.counts?.CATALOG_SIMPLE || 0
        }
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: pageNum,
        pageSize: limitNum
      }
    };
  } catch (error) {
    console.error('Error fetching catalog templates:', error);
    return {
      status: 500,
      success: false,
      message: error.message || 'Internal server error'
    };
  }
};

// @desc    Delete a template (locally + from Meta)
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

    // Only attempt Meta deletion if template is synced
    if (template.isSynced && template.metaTemplateId) {
      const metaCredentials = await getBusinessProfileMetaApiCredentials(
        businessProfileId,
        userId,
        tenantId
      );

      if (metaCredentials.success) {
        const { accessToken, wabaId } = metaCredentials;

        const deleteUrl = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates?name=${template.name}`;

        try {
          await axios.delete(deleteUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });
          console.log(`✅ Deleted template from Meta: ${template.name}`);
        } catch (metaDeleteErr) {
          console.warn(
            `⚠️ Failed to delete template from Meta: ${template.name}`,
            metaDeleteErr.response?.data || metaDeleteErr.message
          );
          // Optional: continue even if Meta deletion fails
        }
      } else {
        console.warn(
          "⚠️ Skipping Meta deletion due to missing credentials:",
          metaCredentials.message
        );
      }
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
    const url = `${facebookUrl}/${graphVersion}/${wabaId}/message_templates?limit=250`; 

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log("Meta API response for template sync:", response.data);

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
      console.log(
        `Processing Meta template: ${metaTemplate.name} (${metaTemplate.language})`
      );
      const existingTemplate = await Template.findOne(filter);

      if (existingTemplate) {
        // Update existing
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
          // Handle duplicate creation race condition or index error
          if (err.code === 11000) {
            console.warn(
              `Duplicate template skipped: ${metaTemplate.name} (${metaTemplate.language})`
            );
            skippedCount++;
          } else {
            throw err; // rethrow unexpected errors
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
      message: `Failed to synchronize templates from Meta: ${error.response?.data?.error?.message || error.message
        }. Ensure your selected business profile has correct WABA ID and Access Token.`,
    };
  }
};

exports.getPlainTextTemplates = async (req) => {
  const tenantId = req.tenant?._id;
  const userId = req.user?._id;
  const { businessProfileId, page = 1, limit = 10 } = req.query;

  if (!tenantId || !userId) {
    return {
      status: 400,
      success: false,
      message: "Missing tenantId or userId in request"
    };
  }

  if (!businessProfileId) {
    return {
      status: 400,
      success: false,
      message: "Missing businessProfileId in request"
    };
  }

  const matchStage = {
    tenantId,
    userId,
    metaStatus: 'APPROVED',
    businessProfileId: new mongoose.Types.ObjectId(businessProfileId),
    $or: [
      { type: { $exists: false } },
      { type: 'STANDARD' }
    ]
  };

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNum - 1) * pageLimit;

  try {
    const aggregationPipeline = [
      {
        $match: matchStage
      },
      {
        $match: {
          components: {
            $not: {
              $elemMatch: {
                $or: [
                  { type: "CAROUSEL" },
                  { format: { $in: ['CAROUSEL'] } },
                  { text: { $regex: "{{.*}}", $options: "i" } }
                ]
              }
            }
          }
        }
      },
      {
        $facet: {
          templates: [
            { $skip: skip },
            { $limit: pageLimit }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const result = await Template.aggregate(aggregationPipeline);

    const templates = result?.[0]?.templates || [];
    const totalCount = result?.[0]?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / pageLimit);

    return {
      status: 200,
      success: true,
      message: templates.length
        ? resMessage.Template_fetched
        : resMessage.No_data_found + ' for the selected business profile.',
      data: templates,
      pagination: {
        totalCount,
        totalPages,
        currentPage: pageNum
      }
    };

  } catch (error) {
    console.error("❌ Error in getPlainTextTemplates:", error);
    return {
      status: 500,
      success: false,
      message: error.message || "Server error"
    };
  }
};

exports.createCatalogTemplate = async (req) => {
  try {
    const { businessProfileId } = req.params;
    const {name, language, category, bodyText, parameter_format, footer_text, example } = req.body;
    const businessData = await BusinessProfile.findOne({ _id: businessProfileId, tenantId: req.tenant._id, userId: req.user._id });
    if (!businessData) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Invalid_business_ID
      }
    }

    // Find max variable length
    const placeholderRegex = /{{\s*(\d+)\s*}}/g;
    const matches = bodyText ? [...bodyText.matchAll(placeholderRegex)].map(m => parseInt(m[1], 10)) : [];
    const maxIndex = matches.length ? Math.max(...matches.filter(n => !isNaN(n))) : 0;

    // match variable to example number 
    if (maxIndex > 0) {
      if (!example || !example.body_text || !Array.isArray(example.body_text) || example.body_text.length === 0) {
        return {
          status: statusCode.BAD_REQUEST,
          success: false,
          message: "Example values are required for templates with placeholders (provide example.body_text)."
        };
      }
      const firstExampleRow = example.body_text[0];
      if (!Array.isArray(firstExampleRow) || firstExampleRow.length < maxIndex) {
        return {
          status: statusCode.BAD_REQUEST,
          success: false,
          message: `Example must include at least ${maxIndex} positional values in example.body_text[0].`
        };
      }
    }

    //options
    const options = {
      ...(parameter_format && { parameter_format }),
      ...(footer_text && { footer_text }),
      ...(example && { example })
    };

    try {
      const result = await createCatalogTemplate(businessData.metaBusinessId, name, language, category, bodyText, businessData.metaAccessToken, options);
      return {
        status: statusCode.SUCCESS,
        success: true,
        message: resMessage.Catalog_template_created,
        data: result
      };
    } catch (serviceError) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: serviceError.message || "Failed to create catalog template"
      };
    }
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
}

exports.sendCatalogTemplate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { to, parameters, template_name } = req.body;
    const projectData = await Project.findOne({ _id: projectId, tenantId: req.tenant._id, userId: req.user._id });
    if (!projectData) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.ProjectId_dont_exists
      }
    }
    const businessData = await BusinessProfile.findOne({ _id: projectData.businessProfileId, tenantId: req.tenant._id, userId: req.user._id, catalogAccess: true });
    if (!businessData) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Invalid_business_ID
      }
    }
    const response = await sendCatalogTemplateMessage(to, parameters, projectData.metaPhoneNumberID, template_name, businessData.metaAccessToken);
    if (!response.success) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: response.error
      }
    }
    return {
        status: statusCode.OK,
        success: true,
        message: resMessage.Catalog_template_sent
      }
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};