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

