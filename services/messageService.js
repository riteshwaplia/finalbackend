// server/services/messageService.js
const axios = require("axios");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const Message = require("../models/Message");
const Template = require("../models/Template");
const Project = require("../models/project");
const Contact = require("../models/Contact");
const BulkSendJob = require("../models/BulkSendJob");
const { statusCode, resMessage } = require("../config/constants");
const { chunkArray } = require("../utils/helpers");
const { v4: uuidv4 } = require("uuid");

const BATCH_SIZE = 20;

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

      templateComponents.forEach((component) => {
        if (component.type === "HEADER" && component.format === "IMAGE") {
          console.log("Header component found:", component);
          const imageLink = component.example?.header_handle?.[0];
          if (imageLink) {
            components.push({
              type: "HEADER",
              parameters: [
                {
                  type: "image",
                  image: { id: imageId },
                },
              ],
            });
          }
        }
      });

      if (contactRow.header_text) {
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

// @desc    Send bulk messages from an group
// @access  Private

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

const sendBulkCarouselMessageService = async (req) => {
  const { templateName, message = {} } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const fileName = req.file?.originalname || "manual_upload.xlsx";

  if (!templateName || !req.file || Object.keys(message).length === 0) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (templateName, file, and message are required).",
    };
  }

  const project = await Project.findOne({
    _id: projectId,
    tenantId,
    userId,
  }).populate("businessProfileId");
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
  const graphVersion = businessProfile.graphVersion || "v19.0";

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

  // Parse the message JSON object provided in the request
  let parsedMessage =
    typeof message === "string" ? JSON.parse(message) : message;
  const templateLanguageCode = parsedMessage.language?.code || "en_US";

  // Validate the message structure for a carousel
  const carouselComponent = parsedMessage.components?.find(
    (c) => c.type === "CAROUSEL"
  );
  if (
    !carouselComponent ||
    !Array.isArray(carouselComponent.cards) ||
    carouselComponent.cards.length === 0
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        "Invalid carousel message payload. 'message' must contain a carousel component with cards.",
    };
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
      components: parsedMessage.components,
      language: templateLanguageCode,
    },
  });

  let totalSent = 0;
  let totalFailed = 0;
  const errorsSummary = [];

  const contactBatches = chunkArray(contacts, BATCH_SIZE);

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

      // Prepare components for WhatsApp API payload
      const components = [];

      // Handle BODY component from template
      const bodyComponent = parsedMessage.components.find(
        (c) => c.type === "BODY"
      );
      if (bodyComponent) {
        const bodyParameters = [];
        // Get all body variables from Excel (body_1, body_2, etc.)
        let bodyIndex = 1;
        while (contactRow[`body_${bodyIndex}`] !== undefined) {
          bodyParameters.push({
            type: "text",
            text: String(contactRow[`body_${bodyIndex}`]),
          });
          bodyIndex++;
        }

        if (bodyParameters.length > 0) {
          components.push({
            type: "body",
            parameters: bodyParameters,
          });
        }
      }

      // Handle CAROUSEL component
      const carouselCards = [];
      const carouselComponent = parsedMessage.components.find(
        (c) => c.type === "CAROUSEL"
      );

      if (carouselComponent?.cards) {
        carouselComponent.cards.forEach((card, cardIndex) => {
          const cardComponents = [];

          // Handle HEADER component for each card
          const headerComponent = card.components.find(
            (c) => c.type === "HEADER"
          );
          if (headerComponent?.example?.header_handle?.id?.[0]) {
            cardComponents.push({
              type: "header",
              parameters: [
                {
                  type: "image",
                  image: {
                    id: headerComponent.example.header_handle.id[0],
                  },
                },
              ],
            });
          }

          // Handle BODY component for each card
          const cardBodyComponent = card.components.find(
            (c) => c.type === "BODY"
          );
          if (cardBodyComponent) {
            const bodyParam = contactRow[`card_${cardIndex}_body_1`]; // Get card-specific body param
            if (bodyParam) {
              cardComponents.push({
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: String(bodyParam),
                  },
                ],
              });
            }
          }

          // Handle BUTTONS component for each card
          const buttonsComponent = card.components.find(
            (c) => c.type === "BUTTONS"
          );
          if (buttonsComponent?.buttons) {
            buttonsComponent.buttons.forEach((button, buttonIndex) => {
              if (button.type === "QUICK_REPLY") {
                cardComponents.push({
                  type: "button",
                  sub_type: "quick_reply",
                  index: buttonIndex,
                  parameters: [], // Quick replies don't typically have parameters
                });
              }
            });
          }

          carouselCards.push({
            card_index: cardIndex,
            components: cardComponents,
          });
        });

        if (carouselCards.length > 0) {
          components.push({
            type: "carousel",
            cards: carouselCards,
          });
        }
      }
      const templateMessage = {
        name: templateName,
        language: { code: templateLanguageCode },
        components,
      };

      console.log("📦 Template message prepared:", templateMessage);
      try {
        const sendResult = await sendWhatsAppMessage({
          to: to,
          type: "template",
          message: templateMessage,
          phoneNumberId,
          accessToken,
          facebookUrl,
          graphVersion,
        });
        console.log("res of send", sendResult);

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

        if (sendResult.success) {
          totalSent++;
        } else {
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
      if (message.link) payload.video.link = message.link;
      if (message.caption) payload.video.caption = message.caption;
      break;

    case "template": {
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
  const { imageId } = req.body;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  if (!imageId) {
    return {
      status: 400,
      success: false,
      message: "Image ID is required",
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

    // 1. Get media URL from Meta
    const metadataResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${imageId}`,
      {
        headers: {
          Authorization: `Bearer ${project.businessProfileId.metaAccessToken}`,
        },
      }
    );

    const mediaUrl = metadataResponse.data.url;

    // 2. Download media binary
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${project.businessProfileId.metaAccessToken}`,
      },
      responseType: "arraybuffer",
    });

    const contentType = mediaResponse.headers["content-type"];
    const extension = contentType.split("/")[1] || "jpg";
    const fileName = `meta-image-${uuidv4()}.${extension}`;
    const tempDir = path.join(__dirname, "../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, mediaResponse.data);

    const fileStream = fs.createReadStream(filePath);

    // Automatically delete file when stream closes
    fileStream.on("close", async () => {
      try {
        await fsPromises.unlink(filePath);
        console.log("🗑️ Temp file deleted:", filePath);
      } catch (err) {
        console.error("❌ Error deleting file:", err.message);
      }
    });

    return {
      status: 200,
      success: true,
      message: "Media downloaded successfully",
      stream: fileStream,
      mimeType: contentType,
      fileName,
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
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
  sendBulkCarouselMessageService,
  getAllBulkSendJobsService,
  getBulkSendJobDetailsService,
  downloadMedia,
};
