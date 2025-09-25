// server/services/messageService.js
const axios = require("axios");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const Message = require("../models/Message");
const Template = require("../models/Template");
const Project = require("../models/Project");
const Contact = require("../models/Contact");
const BulkSendJob = require("../models/BulkSendJob");
const { statusCode, resMessage } = require("../config/constants");
const { chunkArray } = require("../utils/helpers");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const fsPromises = require("fs/promises");
const mime = require("mime-types");

const sendWhatsAppMessage = async ({
  to,
  type,
  message,
  phoneNumberId,
  accessToken,
  facebookUrl,
  graphVersion,
}) => {
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
    console.log("resposmne from sendmessage service", response.data);
    return { success: true, data: response.data };
  } catch (err) {
    const error = err.response?.data || err.message;
    console.error("Send WhatsApp Message Error (Meta API call failed):", error);
    return { success: false, error };
  }
};

// http://localhost:5173

const sendMessageService = async (req) => {
  const { to, type, message } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

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
      message:
        resMessage.Project_whatsapp_number_not_configured +
        " (WhatsApp number not verified or Meta Phone Number ID is missing for this project. Please link and verify a WhatsApp number to this project).",
    };
  }
  const phoneNumberId = project.metaPhoneNumberID;

  const businessProfile = project.businessProfileId;
  businessProfile.graphVersion = businessProfile.graphVersion || "v16.0";
  businessProfile.facebookUrl =
    businessProfile.facebookUrl || "https://graph.facebook.com";

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

    const messageData = new Message({
      to,
      type,
      message,
      metaResponse: sendResult.data,
      status: sendResult.success ? "sent" : "failed",
      userId,
      tenantId,
      projectId,
      metaPhoneNumberID: phoneNumberId,
      direction: "outbound",
      templateName: type === "template" ? message.name : undefined,
      templateLanguage:
        type === "template" ? message.language?.code : undefined,
    });
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

const sendBulkMessageService = async (req) => {
  const { templateName, message = {}, imageId } = req.body;
  console.log("imgageId", imageId);
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const fileName = req.file?.originalname || "manual_upload.xlsx";

  const userBatchSize = await User.findOne({ _id: req.user._id, tenantId: req.tenant._id }).select('batch_size');
  const BATCH_SIZE = userBatchSize?.batch_size || 20;

  if (!templateName || !req.file) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Missing_required_fields + " (templateName and file are required for bulk send).",
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
      message: resMessage.No_data_found + " (Project not found or does not belong to you).",
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

  if (!businessProfile || !businessProfile.metaAccessToken || !businessProfile.metaBusinessId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Meta_API_credentials_not_configured,
    };
  }

  const accessToken = businessProfile.metaAccessToken;
  const facebookUrl = businessProfile.facebookUrl || "https://graph.facebook.com";
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

  let parsedMessage;
  try {
    parsedMessage = typeof message === "string" ? JSON.parse(message) : message;
  } catch (err) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: "Invalid JSON format in 'message' field.",
    };
  }

  let templateComponents = parsedMessage.components;
  let templateLanguageCode = parsedMessage.language?.code || "en_US";
  let localTemplate;

  if (!templateComponents || templateComponents.length === 0) {
    localTemplate = await Template.findOne({
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
        errorsSummary.push({ to: mobileNumber, error: "Invalid mobile number format in Excel." });
        return;
      }

      const components = [];

      for (const comp of templateComponents) {
        if (comp.type === 'HEADER') {
          const headerParameters = [];
          const hasVariables = comp.text?.includes('{{');

          if (comp.format === 'IMAGE' && imageId) {
            components.push({
              type: 'header',
              parameters: [{ type: 'image', image: { id: imageId } }],
            });
          } else if (comp.format === 'TEXT' && hasVariables) {
            const variableValue = contactRow['header_Example 1'];

            if (variableValue) {
              headerParameters.push({ type: 'text', text: variableValue });
            }
            components.push({
              type: 'header',
              parameters: headerParameters,
            });
          } else if (comp.format === 'TEXT' && comp.text) {
            components.push({
              type: 'header',
              parameters: [{ type: 'text', text: comp.text }],
            });
          }
        } else if (comp.type === 'BODY') {
          const bodyParameters = [];
          const bodyVariables = comp.text?.match(/{{(\d)}}/g);

          if (bodyVariables) {
            for (const variable of bodyVariables) {
              const varIndex = variable.match(/{{(\d)}}/)[1];
              const variableValue = contactRow[`body_Example_${varIndex}`];

              if (variableValue) {
                bodyParameters.push({ type: 'text', text: variableValue });
              }
            }
          }
          
          components.push({
            type: 'body',
            parameters: bodyParameters,
          });

        } else if (comp.type === 'FOOTER') {
          components.push({
            type: 'footer',
          });
        } else if (comp.type === 'BUTTONS') {
          if (comp.buttons && comp.buttons.length > 0) {
            comp.buttons.forEach((button, index) => {
              if (button.type === 'QUICK_REPLY') {
                const payload = button.text.toLowerCase().replace(/ /g, '_') + '_payload';
                components.push({
                  type: 'button',
                  sub_type: 'quick_reply',
                  index: String(index),
                  parameters: [{ type: 'payload', payload: payload }],
                });
              }
            });
          }
        }
      }
      
      const templateMessage = {
        name: baseMessage.name,
        language: baseMessage.language,
        components,
      };

      const messagePayload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: templateMessage,
      };

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
          errorsSummary.push({ to, error: sendResult.error || "Unknown error" });
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

// @desc    Send bulk messages from an group
// @access  Private

const ScheduleBulkSendService = async (req) => {
  const { templateName, scheduledAt } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  if (!templateName || !scheduledAt || !req.file) {
    return {
      status: 400,
      success: false,
      message: "Missing required fields (templateName, scheduledAt, file)."
    };
  }

  try {
    // Validate scheduled time is in future
    const scheduledTime = new Date(scheduledAt);
    if (scheduledTime <= new Date()) {
      return {
        status: 400,
        success: false,
        message: "Scheduled time must be in the future."
      };
    }

    const newJob = await ScheduledBulkJob.create({
      tenantId,
      userId,
      projectId,
      templateName,
      fileName: req.file.originalname,
      scheduledAt: scheduledTime,
      status: 'pending',
      meta: {
        filePath: req.file.path,
        message: req.body.message || {}
      }
    });

    return {
      status: 201,
      success: true,
      message: "Bulk message scheduled successfully!",
      data: newJob
    };
  } catch (error) {
    // Clean up uploaded file if job creation fails
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to clean up file:", err);
      }
    }
    return {
      status: 500,
      success: false,
      message: "Failed to schedule job.",
      error: error.message
    };
  }
};



const BulkSendGroupService = async (req) => {
  const { templateName, message = {}, groupId, contactfields = [] } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  if (!templateName || !groupId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (templateName and groupId are required for group bulk send).",
    };
  }

  const project = await Project.findOne({
    _id: projectId,
    tenantId,
    userId,
  }).populate("businessProfileId");
  console.log("📁 Project loaded:", project ? project._id : null);

  if (!project || !project.isWhatsappVerified || !project.metaPhoneNumberID) {
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

  const contacts = await Contact.find({
    groupIds: groupId,
    userId,
    tenantId,
    projectId,
    isBlocked: false,
  });

  console.log("👥 Contacts fetched:", contacts.length);
  if (!contacts.length) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.No_valid_contacts_for_bulk_send +
        " (No contacts found for the group).",
    };
  }

  let parsedMessage =
    typeof message === "string" ? JSON.parse(message) : message;
  let templateComponents = parsedMessage.components;
  console.log("🧩 Initial template components:", templateComponents);
  let templateLanguageCode = parsedMessage.language?.code || "en_US";

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
    groupId,
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

  for (const [batchIndex, batch] of contactBatches.entries()) {
    const sendPromises = batch.map(async (contact, i) => {
      const mobileNumber = String(contact.mobileNumber || "");
      const to = String(contact.mobileNumber || "");

      if (!mobileNumber || mobileNumber.length < 5) {
        totalFailed++;
        errorsSummary.push({
          to: mobileNumber,
          error: "Invalid mobile number format.",
        });
        return;
      }

      if (!to.startsWith("91") && process.env.NODE_ENV !== "production") {
        totalFailed++;
        errorsSummary.push({ to, error: "Not in test number list (sandbox)." });
        return;
      }

      const components = [];

      // HEADER (text or image)
      const headerTemplate = templateComponents.find(
        (c) => c.type === "HEADER"
      );
      if (headerTemplate) {
        if (headerTemplate.format === "IMAGE") {
          const imageLink = headerTemplate.example?.header_handle?.[0];
          if (imageLink) {
            components.push({
              type: "HEADER",
              parameters: [{ type: "image", image: { link: imageLink } }],
            });
          }
        } else if (headerTemplate.format === "TEXT") {
          const expectedHeaderParams =
            headerTemplate.text?.match(/{{\d+}}/g)?.length || 0;
          if (expectedHeaderParams > 0) {
            const headerKey = contactfields[0] || "First name";
            const headerValue = contact.customFields?.[headerKey] || "User";
            components.push({
              type: "HEADER",
              parameters: [{ type: "text", text: headerValue }],
            });
          }
        }
      }

      // BODY
      const bodyTemplate = templateComponents.find((c) => c.type === "BODY");
      const expectedBodyParams =
        bodyTemplate?.text?.match(/{{\d+}}/g)?.length || 0;
      if (bodyTemplate && expectedBodyParams > 0) {
        const bodyParams = [];

        for (let i = 1; i <= expectedBodyParams; i++) {
          const key = contactfields[i] || `field${i}`;
          const value = contact.customFields?.[key] || "...";
          bodyParams.push({ type: "text", text: value });
        }

        components.push({
          type: "BODY",
          parameters: bodyParams,
        });
      } else if (bodyTemplate && expectedBodyParams === 0) {
      }

      const templateMessage = {
        name: baseMessage.name,
        language: baseMessage.language,
        components,
      };

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
          name: contact.name || "",
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
          totalFailed++;
          errorsSummary.push({ to, error: sendResult.error });
        } else {
          totalSent++;
        }

        await messageLog.save();
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

const extractAndMapParameters = (text, contact, contactfields) => {
    const params = [];
    const variables = text.match(/{{\d+}}/g) || [];

    variables.forEach(variable => {
        const index = parseInt(variable.match(/\d+/)[0], 10);
        const keyFromContactFields = contactfields[index - 1];
        const lowerCaseKey = keyFromContactFields ? keyFromContactFields.toLowerCase() : `field${index}`;
        
        let value = '...';

        if (contact && (lowerCaseKey === 'name' || lowerCaseKey === 'full name') && contact.name) {
            value = contact.name;
        } else if (contact && (lowerCaseKey === 'email' || lowerCaseKey === 'email address') && contact.email) {
            value = contact.email;
        } else if (contact && lowerCaseKey === 'mobilenumber' && contact.mobileNumber) {
            value = contact.mobileNumber;
        }
        else if (contact.customFields) {
            const customFieldKeys = Object.keys(contact.customFields);
            const foundCustomFieldKey = customFieldKeys.find(cfKey => cfKey.toLowerCase() === lowerCaseKey);
            if (foundCustomFieldKey) {
                value = contact.customFields[foundCustomFieldKey];
            }
        }
        
        params.push({ type: 'text', text: value });
    });
    return params;
};



const getBulkSendJobDetailsService = async (req) => {
  const { bulkSendJobId } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  if (!bulkSendJobId) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields + " (bulkSendJobId is required).",
    };
  }

  try {
    const job = await BulkSendJob.findOne({
      _id: bulkSendJobId,
      tenantId,
      userId,
      projectId,
    });

    if (!job) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Bulk_send_job_not_found,
      };
    }

    const messagesInJob = await Message.find({
      bulkSendJobId: bulkSendJobId,
    }).sort({ createdAt: 1 });

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Bulk_send_job_detail_fetched,
      data: {
        jobDetails: job,
        messages: messagesInJob,
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

const getAllBulkSendJobsService = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  try {
    const jobs = await BulkSendJob.find({
      tenantId,
      userId,
      projectId,
    }).sort({ startTime: -1 });

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

const FormData = require("form-data");
const ScheduledBulkJob = require("../models/ScheduledBulkJob");

const uploadMedia = async (req) => {
  const { projectId } = req.params;
  const file = req.file;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!file) {
    return {
      status: 400,
      success: false,
      message: "No file uploaded",
    };
  }

  try {
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

    const form = new FormData();
    form.append("file", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    form.append("type", file.mimetype);
    form.append("messaging_product", "whatsapp");

    const uploadUrl = `https://graph.facebook.com/v19.0/${project.metaPhoneNumberID}/media`;
    const uploadResponse = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${project.businessProfileId.metaAccessToken}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

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

const sendWhatsAppMessages = async ({
  phoneNumberId,
  accessToken,
  to,
  type,
  message,
  FACEBOOK_URL,
}) => {
  const PHONE_NUMBER_ID = phoneNumberId;
  const ACCESS_TOKEN = accessToken;
  const url = `${FACEBOOK_URL}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type,
  };

  switch (type) {
    case "text":
      payload.text = { body: message.text?.body || message.text };
      break;

    case "video":
      payload.video = {};
      if (message.id) payload.video.id = message.id;
      if (message.link) payload.video.link = message.link;
      if (message.caption) payload.video.caption = message.caption;
      break;
 
    case 'audio':
      payload.audio = {};
      if (message.id) payload.audio.id = message.id;
      if (message.link) payload.audio.link = message.link;
      break;

    case 'template': {
      const languageCode =
        typeof message.language === "string"
          ? message.language
          : message.language?.code;

      payload.template = {
        name: message.name,
        language: { code: languageCode || "en_US" },
      };

      if (Array.isArray(message.components) && message.components.length > 0) {
        payload.template.components = message.components;
      }
      break;
    }

    case "image":
      payload.image = {};
      if (message.id) payload.image.id = message.id;
      if (message.link) payload.image.link = message.link;
      if (message.caption) payload.image.caption = message.caption;
      break;

    case "document":
      payload.document = {};
      if (message.link) payload.document.link = message.link;
      if (message.id) payload.document.id = message.id;
      if (message.filename) payload.document.filename = message.filename;
      break;

    default:
      return {
        success: false,
        error: "Unsupported message type in payload building",
      };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data && to && type === "text") {
      await Chat.create({
        from: "Wachat",
        to,
        direction: "outgoing",
        text: payload.text?.body,
        status: "sent",
        type,
        messageId: response.data.messages?.[0]?.id || null,
      });
    }

    return { success: true, data: response.data };
  } catch (err) {
    const error = err.response?.data || err.message;
    console.error("Send WhatsApp Message Error:", error);
    return { success: false, error };
  }
};

const downloadMedia = async (req) => {
  const { projectId } = req.params;
  const { imageId } = req.body; // imageId is the mediaId
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!imageId) {
    return {
      success: false,
      status: 400,
      message: "Media ID is required",
    };
  }

  try {
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
        success: false,
        status: 400,
        message: "Invalid project configuration",
      };
    }

    const accessToken = project.businessProfileId.metaAccessToken;

    const metadataResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${imageId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const mediaUrl = metadataResponse.data.url;
    const mimeType = metadataResponse.data.mime_type || "application/octet-stream";
    const extension = mime.extension(mimeType) || "bin"; 
    const fileName = `meta-media-${uuidv4()}.${extension}`;

    console.log("⬇️ Downloading media binary from Meta...");
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: "arraybuffer",
    });

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
      console.log("📁 Temp directory created:", tempDir);
    }

    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, mediaResponse.data);

    const fileStream = fs.createReadStream(filePath);

    fileStream.on("close", async () => {
      try {
        await fsPromises.unlink(filePath);
        console.log("🗑️ Temp file deleted:", filePath);
      } catch (err) {
        console.error("❌ Error deleting file:", err.message);
      }
    });
    return {
      success: true,
      status: 200,
      stream: fileStream,
      mimeType,
      fileName,
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.response?.data?.error?.message || "Download failed",
      error: error.response?.data || error.message,
    };
  }
};

module.exports = {
  sendMessageService,
  sendWhatsAppMessages,
  uploadMedia,
  BulkSendGroupService,
  sendBulkMessageService,
  getAllBulkSendJobsService,
  getBulkSendJobDetailsService,
  downloadMedia,
  ScheduleBulkSendService
};
