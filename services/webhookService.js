// server/services/webhookService.js
const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Conversation = require("../models/ConversationSchema");
const Project = require("../models/project");
const { statusCode, resMessage } = require("../config/constants");
const Businessprofile = require("../models/BusinessProfile");
const Flow = require("../models/Flow");
const { traverseFlow } = require("../functions/functions");
const { sendWhatsAppMessages } = require("../services/messageService");
const ConversationSession = require("../models/ConversationSessionSchema");
const { createOrderFromWebhook, sendPaymentLink } = require("./orderService");
const { generatePaymentLink } = require("../services/paymentService");

exports.handleWebhookPayload = async (req) => {
  const io = req.app.get("io");
  let businessProfileData;

  if (req.method === "GET") {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("Webhook GET request received for verification.");

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED: Successfully subscribed to webhook.");
        return { status: statusCode.OK, raw: true, body: challenge };
      } else {
        console.error(
          "Webhook verification failed: Invalid verify token or mode."
        );
        return {
          status: statusCode.FORBIDDEN,
          success: false,
          message:
            resMessage.Webhook_verification_failed ||
            "Webhook verification failed.",
        }; // Use a constant if available
      }
    }
    console.warn(
      "Invalid verification request: Missing mode or token in query parameters."
    );
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: "Invalid verification request.",
    };
  }

  const payload = req.body;
  console.log("=======Webhook data========", JSON.stringify(payload, null, 2));

  try {
    if (
      !payload ||
      !payload.object ||
      payload.object !== "whatsapp_business_account"
    ) {
      console.warn(
        "Webhook payload not for 'whatsapp_business_account' or invalid object type. Payload:",
        JSON.stringify(payload)
      );
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Invalid webhook object type.",
      };
    }

    for (const entry of payload.entry) {
      const metaPhoneNumberID =
        entry.changes?.[0]?.value?.metadata?.phone_number_id;

      if (!metaPhoneNumberID) {
        console.warn(
          `[Webhook] Could not extract Meta Phone Number ID from entry. Skipping entry. Entry: ${JSON.stringify(
            entry
          )}`
        );
        continue;
      }
      for (const change of entry.changes) {
        if (change.field === "messages") {
          const value = change.value;

          if (value.statuses) {
            for (const statusUpdate of value.statuses) {
              const metaMessageId = statusUpdate.id;
              const newStatus = statusUpdate.status;
              const timestamp = new Date(
                parseInt(statusUpdate.timestamp) * 1000
              );
              const messageDoc = await Message.findOne({
                metaMessageId: metaMessageId,
                metaPhoneNumberID: metaPhoneNumberID,
              });

              if (messageDoc) {
                messageDoc.status = newStatus;
                messageDoc.updatedAt = new Date();
                messageDoc.sentAt = timestamp;
                if (statusUpdate.errors && statusUpdate.errors.length > 0) {
                  messageDoc.errorDetails = statusUpdate.errors;
                  console.error(
                    `[Webhook Status Update Error] Details for ${metaMessageId}:`,
                    JSON.stringify(statusUpdate.errors)
                  );
                }
                await messageDoc.save();
                if (io) {
                  io.to(messageDoc.userId.toString()).emit(
                    "messageStatusUpdate",
                    {
                      messageDbId: messageDoc._id,
                      metaMessageId,
                      newStatus,
                      to: messageDoc.to,
                      projectId: messageDoc.projectId,
                      sentAt: messageDoc.sentAt,
                      type: messageDoc.type,
                      conversationId: messageDoc.conversationId,
                    }
                  );
                  if (messageDoc.conversationId) {
                    io.to(messageDoc.conversationId.toString()).emit(
                      "messageStatusUpdate",
                      {
                        messageDbId: messageDoc._id,
                        metaMessageId,
                        newStatus,
                        to: messageDoc.to,
                        projectId: messageDoc.projectId,
                        sentAt: messageDoc.sentAt,
                        type: messageDoc.type,
                        conversationId: messageDoc.conversationId,
                      }
                    );
                  }
                }
              } else {
                console.warn(
                  `[Webhook Status Update] Outbound Message with Meta ID ${metaMessageId} (Phone ID ${metaPhoneNumberID}) not found in DB for status update.`
                );
              }
            }
          }

          if (value.messages) {
            for (const inboundMessage of value.messages) {
              const fromPhoneNumber = inboundMessage.from;
              const whatsappId = inboundMessage.from;
              const projectdetail = await Project.findOne({
                metaPhoneNumberID: metaPhoneNumberID,
              });

              if (!projectdetail) {
                console.warn(
                  `[Inbound Message] No project found for Meta Phone Number ID: ${metaPhoneNumberID}`
                );
                continue;
              }

              businessProfileData = await Businessprofile.findById(
                projectdetail.businessProfileId
              );

              const messageType = inboundMessage.type;
              let messageContent = {};
              switch (messageType) {
                case "text":
                  messageContent = { body: inboundMessage.text.body };
                  break;
                case "image":
                  messageContent = {
                    id: inboundMessage.image.id,
                    mime_type: inboundMessage.image.mime_type,
                    caption: inboundMessage.image.caption || null,
                  };
                  break;
                case "video":
                  messageContent = {
                    id: inboundMessage.video.id,
                    mime_type: inboundMessage.video.mime_type,
                    caption: inboundMessage.video.caption || null,
                  };
                  break;
                case "audio":
                  messageContent = {
                    id: inboundMessage.audio.id,
                    mime_type: inboundMessage.audio.mime_type,
                  };
                  break;
                case "document":
                  messageContent = {
                    id: inboundMessage.document.id,
                    filename: inboundMessage.document.filename,
                    mime_type: inboundMessage.document.mime_type,
                    caption: inboundMessage.document.caption || null,
                  };
                  break;
                case "sticker":
                  messageContent = {
                    id: inboundMessage.sticker.id,
                    animated: inboundMessage.sticker.animated,
                  };
                  break;
                case "location":
                  messageContent = {
                    latitude: inboundMessage.location.latitude,
                    longitude: inboundMessage.location.longitude,
                    name: inboundMessage.location.name,
                    address: inboundMessage.location.address,
                  };
                  break;
                case "contacts":
                  messageContent = inboundMessage.contacts;
                  break;
                case "interactive":
                  if (inboundMessage.interactive.button_reply) {
                    messageContent = {
                      type: "button_reply",
                      id: inboundMessage.interactive.button_reply.id,
                      title: inboundMessage.interactive.button_reply.title,
                    };
                  } else if (inboundMessage.interactive.list_reply) {
                    messageContent = {
                      type: "list_reply",
                      id: inboundMessage.interactive.list_reply.id,
                      title: inboundMessage.interactive.list_reply.title,
                    };
                  }
                  break;
                case "order":
                  messageContent = inboundMessage.order;
                  break;
                default:
                  messageContent = inboundMessage[messageType];
              }

              // STEP 2: Contact resolution
              const profileName =
                inboundMessage.contacts?.[0]?.profile?.name || fromPhoneNumber;
              const parsedPhoneNumber = fromPhoneNumber.replace(/^\+/, "");

              let contact = await Contact.findOne({
                tenantId: projectdetail.tenantId,
                projectId: projectdetail._id,
                mobileNumber: parsedPhoneNumber,
              });

              if (!contact) {
                contact = await Contact.create({
                  tenantId: projectdetail.tenantId,
                  userId: projectdetail.userId,
                  projectId: projectdetail._id,
                  name: profileName,
                  mobileNumber: parsedPhoneNumber,
                  whatsappId,
                  profileName,
                });
              }

              // STEP 3: Conversation resolution
              let conversation = await Conversation.findOne({
                projectId: projectdetail._id,
                contactId: contact._id,
                metaPhoneNumberID: metaPhoneNumberID,
              });

              if (!conversation) {
                conversation = await Conversation.create({
                  tenantId: projectdetail.tenantId,
                  userId: projectdetail.userId,
                  projectId: projectdetail._id,
                  contactId: contact._id,
                  metaPhoneNumberID: metaPhoneNumberID,
                  latestMessage:
                    messageType === "text"
                      ? messageContent.body
                      : `[${messageType}]`,
                  latestMessageType: messageType,
                  lastActivityAt: new Date(
                    parseInt(inboundMessage.timestamp) * 1000
                  ),
                  unreadCount: 1,
                });
              }

              // STEP 4: Special case → ORDER HANDLING
              if (messageType === "order") {
                try {
                  const orderResult = await createOrderFromWebhook(
                    inboundMessage,
                    projectdetail,
                    contact,
                    conversation._id
                  );

                  if (orderResult.success) {
                    // ✅ build order URL for frontend payment page
                    const baseUrl =
                      process.env.FRONTEND_URL || "https://sabnode.netlify.app";
                    const orderUrl = `${baseUrl}/${projectdetail._id}/${orderResult.order._id}`;

                    // send via WhatsApp
                    await sendPaymentLink({
                      to: contact.mobileNumber,
                      phoneNumberId: projectdetail.metaPhoneNumberID,
                      accessToken: businessProfileData.metaAccessToken,
                      paymentUrl: orderUrl,
                    });

                    console.log(
                      `[Order Flow] Payment link sent to ${contact.mobileNumber}`
                    );
                  } else {
                    console.error(
                      `[Order Flow] Failed to create order: ${orderResult.error}`
                    );
                  }
                } catch (err) {
                  console.error(
                    `[Order Flow] Unexpected error: ${err.message}`
                  );
                }
              }

              // STEP 5: Save inbound message as usual
              const messageDoc = await Message.create({
                tenantId: projectdetail.tenantId,
                userId: projectdetail.userId,
                projectId: projectdetail._id,
                conversationId: conversation._id,
                metaPhoneNumberID: metaPhoneNumberID,
                from: fromPhoneNumber,
                direction: "inbound",
                type: messageType,
                message: messageContent,
                metaMessageId: inboundMessage.id,
                status: "received",
                sentAt: new Date(parseInt(inboundMessage.timestamp) * 1000),
              });

              if (io) {
                io.to(projectdetail.userId.toString()).emit(
                  "newInboundMessage",
                  {
                    message: messageDoc.toObject(),
                    conversation: conversation.toObject(),
                    contact: contact.toObject(),
                  }
                );
              }
            }
          }
        }
      }
    }
    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.WEBHOOK_RECEIVE_SUCCESS,
    };
  } catch (error) {
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};
