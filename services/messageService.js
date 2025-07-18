// server/services/messageService.js
const axios = require("axios");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Template = require("../models/Template");
const Project = require("../models/Project");
const BusinessProfile = require("../models/BusinessProfile");
const BulkSendJob = require("../models/BulkSendJob"); // NEW: Import BulkSendJob model
const { statusCode, resMessage } = require("../config/constants");
const { chunkArray, buildTemplateMessage } = require("../utils/helpers");

const BATCH_SIZE = 20; // Number of messages to send in one batch

/**
 * Sends a single WhatsApp message using provided Meta API credentials.
 * This helper is used by both single and bulk message sending.
 * @param {Object} options - Options for sending message.
 * @param {string} options.to - Recipient's phone number.
 * @param {string} options.type - Message type.
 * @param {Object} options.message - The message payload.
 * @param {string} options.phoneNumberId - The specific WhatsApp Phone Number ID for sending (from Meta).
 * @param {string} options.accessToken - Meta Access Token.
 * @param {string} options.facebookUrl - Meta Graph API URL.
 * @param {string} options.graphVersion - Meta Graph API version.
 * @returns {Object} Success status and data/error.
 */
const sendWhatsAppMessage = async ({
  to,
  type,
  message,
  phoneNumberId,
  accessToken,
  facebookUrl,
  graphVersion,
}) => {
  // Validate core Meta API credentials
  if (!phoneNumberId || !accessToken || !facebookUrl || !graphVersion) {
    return {
      success: false,
      error:
        resMessage.Meta_API_credentials_not_configured +
        " (Missing Phone ID, Access Token, Facebook URL, or Graph Version).",
    };
  }

  const url = `${facebookUrl}/${graphVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type,
  };

  switch (type) {
    case "text":
      payload.text =
        typeof message.body === "string"
          ? { body: message.body }
          : message.body;
      break;
    case "template":
      payload.template = {
        name: message.name,
        language: {
          code: message.language.code,
        },
      };
      if (Array.isArray(message.components)) {
        payload.template.components = message.components;
      }

      break;
    case "image":
      payload.image = {};
      if (message.link) payload.image.link = message.link;
      if (message.id) payload.image.id = message.id;
      if (message.caption) payload.image.caption = message.caption;
      break;
    case "document":
      payload.document = {};
      if (message.link) payload.document.link = message.link;
      if (message.id) payload.document.id = message.id;
      if (message.filename) payload.document.filename = message.filename;
      if (message.caption) payload.document.caption = message.caption;
      break;
    default:
      return { success: false, error: resMessage.Invalid_message_type };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return { success: true, data: response.data };
  } catch (err) {
    const error = err.response?.data || err.message;
    console.error("Send WhatsApp Message Error (Meta API call failed):", error);
    return { success: false, error };
  }
};

// @desc    Send a single WhatsApp message from the UI
// @access  Private
exports.sendMessageService = async (req) => {
  const { to, type, message } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  // Basic input validation
  if (!to || !type || !message) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (to, type, and message are required for single send).",
    };
  }

  const supportedTypes = ["text", "template", "image", "document"];
  if (!supportedTypes.includes(type)) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Invalid_message_type,
    };
  }

  // 1. Fetch Project to get linked BusinessProfileId AND metaPhoneNumberID
  const project = await Project.findOne({
    _id: projectId,
    tenantId,
    userId,
  }).populate("businessProfileId");
  if (!project) {
    return {
      status: statusCode.NOT_FOUND,
      success: false,
      message:
        resMessage.No_data_found +
        " (Project not found or does not belong to you).",
    };
  }

  // Validate that the project has a configured WhatsApp number
  if (!project.isWhatsappVerified || !project.metaPhoneNumberID) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Project_whatsapp_number_not_configured +
        " (WhatsApp number not verified or Meta Phone Number ID is missing for this project. Please link and verify a WhatsApp number to this project).",
    };
  }
  const phoneNumberId = project.metaPhoneNumberID;

  // 2. Fetch Meta API credentials from the BusinessProfile linked to the Project
  const businessProfile = project.businessProfileId; // Already populated by .populate('businessProfileId')
  if (
    !businessProfile ||
    !businessProfile.metaAccessToken ||
    !businessProfile.metaBusinessId ||
    !businessProfile.facebookUrl ||
    !businessProfile.graphVersion
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Meta_API_credentials_not_configured +
        " for the linked Business Profile. Please update your Business Profile with Access Token, WABA ID, Facebook URL, and Graph Version.",
    };
  }

  // Extract credentials directly from BusinessProfile
  const accessToken = businessProfile.metaAccessToken;
  const facebookUrl = businessProfile.facebookUrl;
  const graphVersion = businessProfile.graphVersion;

  try {
    const sendResult = await sendWhatsAppMessage({
      to,
      type,
      message,
      phoneNumberId,
      accessToken,
      facebookUrl,
      graphVersion,
    });

    // Save message log to DB
    const messageData = new Message({
      to,
      type,
      message,
      metaResponse: sendResult.data,
      status: sendResult.success ? "sent" : "failed",
      userId,
      tenantId,
      projectId,
      metaPhoneNumberID: phoneNumberId, // Store the specific Meta Phone Number ID used
      direction: "outbound", // Mark as outbound from our system
      templateName: type === "template" ? message.name : undefined,
      templateLanguage:
        type === "template" ? message.language?.code : undefined,
    });
    // If sending fails, capture error details
    if (!sendResult.success && sendResult.error) {
      messageData.errorDetails = sendResult.error;
    }
    await messageData.save();

    return {
      status: sendResult.success
        ? statusCode.OK
        : statusCode.INTERNAL_SERVER_ERROR,
      success: sendResult.success,
      message: sendResult.success
        ? resMessage.Message_sent_successfully
        : sendResult.error?.message || resMessage.Message_send_failed,
      data: {
        apiResponse: sendResult.data,
        dbEntry: messageData,
      },
    };
  } catch (error) {
    console.error("Error in sendMessageService:", error.stack);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

// @desc    Send bulk messages from an Excel file
// @access  Private
exports.sendBulkMessageService = async (req) => {
  const { templateName, message = {} } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const fileName = req.file?.originalname || "manual_upload.xlsx";
  console.log("message:", message);
  if (!templateName || !req.file) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (templateName and file are required for bulk send).",
    };
  }

  const project = await Project.findOne({
    _id: projectId,
    tenantId,
    userId,
  }).populate("businessProfileId");
  if (!project) {
    return {
      status: statusCode.NOT_FOUND,
      success: false,
      message:
        resMessage.No_data_found +
        " (Project not found or does not belong to you).",
    };
  }

  if (!project.isWhatsappVerified || !project.metaPhoneNumberID) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Project_whatsapp_number_not_configured,
    };
  }
  const phoneNumberId = project.metaPhoneNumberID;

  const businessProfile = project.businessProfileId;
  if (
    !businessProfile ||
    !businessProfile.metaAccessToken ||
    !businessProfile.metaBusinessId
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Meta_API_credentials_not_configured,
    };
  }
  const accessToken = businessProfile.metaAccessToken;
  const facebookUrl =
    businessProfile.facebookUrl || "https://graph.facebook.com";
  const graphVersion = businessProfile.graphVersion || "v16.0";

  const filePath = path.resolve(req.file.path);
  let contacts = [];
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    contacts = sheetData.filter((row) => row.mobilenumber);
    if (contacts.length === 0) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.No_valid_contacts_for_bulk_send,
      };
    }
  } catch (fileError) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Invalid_file_format,
    };
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  let parsedMessage = message;
  if (typeof message === "string") {
    try {
      parsedMessage = JSON.parse(message);
    } catch (err) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Invalid JSON format in 'message' field.",
      };
    }
  }

  let templateComponents = parsedMessage.components;
  let templateLanguageCode = parsedMessage.language?.code || "en_US";
  console.log("Template components:", templateComponents);
  if (!templateComponents || templateComponents.length === 0) {
    const localTemplate = await Template.findOne({
      tenantId,
      userId,
      businessProfileId: project.businessProfileId,
      name: templateName,
      metaStatus: "APPROVED",
    });
    if (localTemplate) {
      templateComponents = localTemplate.components;
      templateLanguageCode = localTemplate.language;
    } else {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: `Template '${templateName}' not found or not approved.`,
      };
    }
  }

  const bulkSendJob = await BulkSendJob.create({
    tenantId,
    userId,
    projectId,
    templateName,
    fileName,
    totalContacts: contacts.length,
    status: "in_progress",
    startTime: new Date(),
    templateDetails: {
      components: templateComponents,
      language: templateLanguageCode,
    },
  });

  const baseMessage = {
    name: templateName,
    language: { code: templateLanguageCode },
  };

  const contactBatches = chunkArray(contacts, BATCH_SIZE);
  let totalSent = 0;
  let totalFailed = 0;
  const errorsSummary = [];

  for (const batch of contactBatches) {
    const sendPromises = batch.map(async (contactRow) => {
      const mobileNumber = String(contactRow.mobilenumber);
      const countryCode = String(contactRow.countrycode || "");
      const to = `${countryCode}${mobileNumber}`;

      if (!mobileNumber || mobileNumber.length < 5) {
        totalFailed++;
        errorsSummary.push({
          to: mobileNumber,
          error: "Invalid mobile number format in Excel.",
        });
        return;
      }

      const components = [];

      // 1. Add image header from template if applicable
      templateComponents.forEach((component) => {
        if (component.type === "HEADER" && component.format === "IMAGE") {
          const imageLink = component.example?.header_handle?.[0];
          if (imageLink) {
            components.push({
              type: "HEADER",
              parameters: [
                {
                  type: "image",
                  image: { link: imageLink },
                },
              ],
            });
          }
        }
      });

      // 2. Add dynamic header text from Excel if provided (overrides image if present)
      if (contactRow.header_text) {
        // Replace HEADER if already exists (image one)
        const headerIndex = components.findIndex((c) => c.type === "HEADER");
        const headerComponent = {
          type: "HEADER",
          parameters: [{ type: "text", text: contactRow.header_text }],
        };
        if (headerIndex >= 0) {
          components[headerIndex] = headerComponent;
        } else {
          components.push(headerComponent);
        }
      }

      // 3. BODY components from Excel like body_1, body_2, etc.
      const bodyParams = [];
      Object.entries(contactRow).forEach(([key, value]) => {
        if (key.startsWith("body_") && value) {
          bodyParams.push({ type: "text", text: value });
        }
      });
      if (bodyParams.length > 0) {
        components.push({
          type: "BODY",
          parameters: bodyParams,
        });
      }

      // 4. Final message payload
  const templateMessage = {
  name: baseMessage.name,
  language: baseMessage.language,
  components,
};

// ✅ Deep Debug Log
console.log("----- 📤 Sending Template Message -----");
console.log("To:", to);
console.log("Raw Contact Row:", JSON.stringify(contactRow, null, 2));
console.log("Final Message Payload:", JSON.stringify(templateMessage, null, 2));
console.log("Phone Number ID:", phoneNumberId);
console.log("Access Token (masked):", accessToken?.slice(0, 6) + "...(hidden)");
console.log("--------------------------------------");

      try {
        const sendResult = await sendWhatsAppMessage({
          to,
          type: "template",
          message: templateMessage,
          phoneNumberId,
          accessToken,
          facebookUrl,
          graphVersion,
        });

        const messageLog = new Message({
          to,
          type: "template",
          message: templateMessage,
          status: sendResult.success ? "sent" : "failed",
          name: contactRow.name || "",
          metaResponse: sendResult.data,
          userId,
          tenantId,
          projectId,
          metaPhoneNumberID: phoneNumberId,
          direction: "outbound",
          bulkSendJobId: bulkSendJob._id,
          templateName,
          templateLanguage: templateLanguageCode,
        });
        if (!sendResult.success && sendResult.error) {
          messageLog.errorDetails = sendResult.error;
        }
        await messageLog.save();

        if (sendResult.success) totalSent++;
        else {
          totalFailed++;
          errorsSummary.push({
            to,
            error: sendResult.error || "Unknown error",
          });
        }
      } catch (err) {
        totalFailed++;
        errorsSummary.push({ to, error: err.message || "Unhandled exception" });
      }
    });
    await Promise.allSettled(sendPromises);
  }

  bulkSendJob.totalSent = totalSent;
  bulkSendJob.totalFailed = totalFailed;
  bulkSendJob.errorsSummary = errorsSummary;
  bulkSendJob.endTime = new Date();
  bulkSendJob.status = totalFailed > 0 ? "completed_with_errors" : "completed";
  await bulkSendJob.save();

  return {
    status: statusCode.OK,
    success: true,
    message:
      totalFailed > 0
        ? resMessage.Bulk_send_completed_with_errors
        : resMessage.Bulk_messages_sent_successfully,
    data: {
      bulkSendJobId: bulkSendJob._id,
      totalSent,
      totalFailed,
      errorsSummary,
    },
  };
};

/**
 * @desc    Get details of a specific bulk send job, including individual message statuses.
 * @access  Private
 */
exports.getBulkSendJobDetailsService = async (req) => {
  const { bulkSendJobId } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId; // Assuming projectId is also in params for context

  if (!bulkSendJobId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields + " (bulkSendJobId is required).",
    };
  }

  try {
    // Find the bulk send job
    const job = await BulkSendJob.findOne({
      _id: bulkSendJobId,
      tenantId,
      userId,
      projectId, // Ensure job belongs to current user/project/tenant
    });

    if (!job) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Bulk_send_job_not_found,
      };
    }

    // Find all messages associated with this bulk send job
    // You might want to paginate this if a single job can have millions of messages
    const messagesInJob = await Message.find({
      bulkSendJobId: bulkSendJobId,
    }).sort({ createdAt: 1 });

    // Optionally, you can enrich messagesInJob with contact names if needed,
    // but it might be too heavy for very large jobs.
    // For now, we'll just return the message documents as they are.

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Bulk_send_job_detail_fetched,
      data: {
        jobDetails: job,
        messages: messagesInJob, // All messages for this job
      },
    };
  } catch (error) {
    console.error("Error fetching bulk send job details:", error.stack);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

/**
 * @desc    Get a list of all bulk send jobs for a project.
 * @access  Private
 */
exports.getAllBulkSendJobsService = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  try {
    const jobs = await BulkSendJob.find({
      tenantId,
      userId,
      projectId,
    }).sort({ startTime: -1 }); // Sort by most recent first

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Bulk_send_jobs_fetched,
      data: jobs,
    };
  } catch (error) {
    console.error("Error fetching all bulk send jobs:", error.stack);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

// Ensure you have multer configured properly
const FormData = require("form-data");

exports.uploadMedia = async (req) => {
  const { projectId } = req.params;
  const file = req.file;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  // Validation
  if (!file) {
    return {
      status: 400,
      success: false,
      message: "No file uploaded",
    };
  }

  try {
    // 1. Get project and business profile
    const project = await Project.findOne({
      _id: projectId,
      userId,
      tenantId,
    }).populate("businessProfileId");

    if (
      !project ||
      !project.metaPhoneNumberID ||
      !project.businessProfileId?.metaAccessToken
    ) {
      return {
        status: 400,
        success: false,
        message: "Invalid project configuration",
      };
    }

    // 2. Prepare form data for WhatsApp
    const form = new FormData();
    form.append("file", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    form.append("type", file.mimetype);
    form.append("messaging_product", "whatsapp");

    // 3. Upload to WhatsApp
    const uploadUrl = `https://graph.facebook.com/v19.0/${project.metaPhoneNumberID}/media`;
    const uploadResponse = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${project.businessProfileId.metaAccessToken}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // 4. Clean up temporary file
    fs.unlinkSync(file.path);

    return {
      status: 200,
      success: true,
      data: {
        id: uploadResponse.data.id,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    };
  } catch (error) {
    // Clean up if error occurred
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    console.error("Upload error:", error.response?.data || error.message);
    return {
      status: 500,
      success: false,
      message: error.response?.data?.error?.message || "Upload failed",
      error: error.response?.data || error.message,
    };
  }
};



const sendWhatsAppMessages = async ({ phoneNumberId, accessToken, to, type, message, FACEBOOK_URL }) => {
  const PHONE_NUMBER_ID = phoneNumberId;
  const ACCESS_TOKEN = accessToken;
console.log("favebookUrl:", FACEBOOK_URL);
  const url = `${FACEBOOK_URL}/${PHONE_NUMBER_ID}/messages`;
 
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type
  };
 
  switch(type) {
    case 'text':
      payload.text = { body: message.text?.body || message.text };
      break;
 
    case 'video':
      payload.video = {};
      if (message.link) payload.video.link = message.link;
      if (message.caption) payload.video.caption = message.caption;
      break;
 
    case 'template':
      payload.template = {
        name: message.name,
        language: {
          code: message.language.code
        }
      };
      if (Array.isArray(message.components)) {
        payload.template.components = message.components;
      }
      break;
 
    case 'image':
      payload.image = {};
      if (message.link) payload.image.link = message.link;
      if (message.id) payload.image.id = message.id;
      if (message.caption) payload.image.caption = message.caption;
      break;
 
    case 'document':
      payload.document = {};
      if (message.link) payload.document.link = message.link;
      if (message.id) payload.document.id = message.id;
      if (message.filename) payload.document.filename = message.filename;
      break;
 
    default:
      return { success: false, error: 'Unsupported message type in payload building' };
  }
 
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
 
    if (response.data && to && type === 'text') {
      await Chat.create({
        from: 'Wachat', // or a fixed string to indicate it's from the business
        to,
        direction: 'outgoing',
        text: payload.text?.body,
        status: 'sent',
        type,
        messageId: response.data.messages?.[0]?.id || null
      });
    }
 
 
    return { success: true, data: response.data };
  } catch (err) {
    const error = err.response?.data || err.message;
    console.error('Send WhatsApp Message Error:', error);
    return { success: false, error };
  }
};

module.exports = {
  sendWhatsAppMessages}