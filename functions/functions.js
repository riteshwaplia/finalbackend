const axios = require("axios");
const nodemailer = require("nodemailer");

exports.traverseFlow = async (entryPointMessage, nodes, edges) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const messages = [];

  const entryNode = nodes.find(
    (n) => n.data?.message?.toLowerCase() === entryPointMessage.toLowerCase()
  );
  if (!entryNode) return [];

  let current = nodeMap.get(
    edges.find((e) => e.source === entryNode.id)?.target
  );

  while (current && current.data) {
    const { type, data } = current;
    const delay = data.meta?.delay || 0;

    if (type === "text") {
      const text = data.message;
      if (text) {
        messages.push({ type: "text", text, delay });
      }
    } else if (type === "image") {
      const mediaId = data.id;
      const url = data.imageUrl || data.url;
      const caption = data.message || data.caption || "";

      if (mediaId) {
        messages.push({
          type: "image",
          id: mediaId,
          caption,
          delay,
        });
      } else if (url) {
        messages.push({
          type: "image",
          link: url,
          caption,
          delay,
        });
      }
    } else if (type === "audio") {
      const audioId = data?.audioId;
      const audioUrl = data.audioUrl || data.url;
      if (audioId || audioUrl) {
        messages.push({
          type: "audio",
          id: audioId,
          link: audioUrl,
          delay,
        });
      }
    } else if (type === "document") {
      const documentId = data.documentId;
      const documentUrl = data.documentUrl || data.url;
      const filename = data.document_name || "document.pdf";
      const caption = data.message || data.caption || "";

      if (documentId) {
        messages.push({
          type: "document",
          id: documentId,
          caption,
          delay,
        });
      } else if (documentUrl) {
        messages.push({
          type: "document",
          link: documentUrl,
          filename,
          caption,
          delay,
        });
      }
    } else if (type === "template") {
      const {
        selectedTemplateId,
        selectedTemplateName,
        selectedTemplateLanguage,
        imageMediaId,
        buttons = [],
        parameters = [],
      } = data;

      const components = [];

      if (imageMediaId) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: { id: imageMediaId },
            },
          ],
        });
      }

      components.push({ type: "body" });

      components.push({ type: "footer" });

      buttons.forEach((btn, index) => {
        components.push({
          type: "button",
          sub_type: "quick_reply",
          index: index.toString(),
          parameters: [
            {
              type: "payload",
              payload: btn.payload,
            },
          ],
        });
      });

      messages.push({
        type: "template",
        templateId: selectedTemplateId,
        templateName: selectedTemplateName,
        templateLang: selectedTemplateLanguage,
        components,
        delay,
      });
    } else if (type === "video") {
      const videoId = data.videoId;
      const caption = data.message || "";
      if (videoId) {
        messages.push({
          type: "video",
          id: videoId,
          caption,
          delay,
        });
      }
    }

    const nextEdge = edges.find((e) => e.source === current.id);
    if (!nextEdge) break;

    current = nodeMap.get(nextEdge.target);
  }

  return messages;
};

exports.sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.PASS_EMAIL,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: '"Devesh Kumar" <deveshtesting9672@gmail.com>',
      to,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

exports.createAuthTemplate = async (
  templateName,
  otp_type,
  language,
  wabaId,
  accessToken
) => {
  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;

  const payload = {
    name: templateName,
    language: language,
    category: "AUTHENTICATION",
    components: [
      {
        type: "BODY",
        example: {
          body_text: [["123456"]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "OTP",
            otp_type: otp_type,
          },
        ],
      },
    ],
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Meta API Error Response:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error("Error making request:", error.message);
    }

    throw new Error(
      error?.response?.data?.error?.message ||
        "Failed to create template on Meta"
    );
  }
};

exports.getBusinessData = async (metaBusinessId, accessToken) => {
  try {
    let BUSINESS_ID = metaBusinessId;
    let ACCESS_TOKEN = accessToken;
    const url = `https://graph.facebook.com/v21.0/${BUSINESS_ID}?access_token=${ACCESS_TOKEN}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching business data:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch business data from Meta API");
  }
};

exports.createProductCatalog = async (metaBusinessId, name, accessToken) => {
  try {
    let BUSINESS_ID = metaBusinessId;
    let catalogName = name;
    let ACCESS_TOKEN = accessToken;
    const url = `https://graph.facebook.com/v19.0/${BUSINESS_ID}/owned_product_catalogs`;
    const response = await axios.post(url, null, {
      params: {
        name: catalogName,
        access_token: ACCESS_TOKEN,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error creating product catalog:",
      error.response?.data || error.message
    );
    throw new Error("Failed to create product catalog");
  }
};

exports.getOwnedProductCatalogs = async (metaId, metaAccessToken) => {
  const url = `https://graph.facebook.com/v16.0/${metaId}/owned_product_catalogs?access_token=${metaAccessToken}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(
      "Error getting product catalog:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

exports.deleteCatalogFromMeta = async (catalogId, metaAccessToken, metaId) => {
  try {
    const url = `https://graph.facebook.com/v16.0/${catalogId}`;

    const response = await axios.delete(url, {
      params: {
        access_token: metaAccessToken,
        business: metaId,
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Error deleting catalog:",
      error?.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

exports.createProduct = async (productData, catalogId, accessToken) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v16.0/${catalogId}/products`,
      productData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Meta API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Meta API Error:", error.response?.data || error.message);

    return {
      error: true,
      details: error.response?.data || { message: error.message },
    };
  }
};

exports.fetchFacebookProducts = async (CATALOG_ID, FB_ACCESS_TOKEN) => {
  const fields = [
    "id",
    "name",
    "price",
    "availability",
    "retailer_id",
    "description",
    "currency",
    "condition",
    "image_url",
  ].join(",");

  const url = `https://graph.facebook.com/v17.0/${CATALOG_ID}/products`;

  try {
    const response = await axios.get(url, {
      params: {
        fields,
        access_token: FB_ACCESS_TOKEN,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching products:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error?.message || "Failed to fetch products"
    );
  }
};

exports.deleteProduct = async (productId, access_token) => {
  try {
    const response = await axios.delete(
      `https://graph.facebook.com/v21.0/${productId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.log(
      "Error coming while delete product",
      error.response?.data || error.message
    );
    throw error.response ? error.response.data : error;
  }
};

exports.updateProduct = async (
  productId,
  ACCESS_TOKEN,
  { name, description, price, currency, availability, condition, image_url }
) => {
  const url = `https://graph.facebook.com/v17.0/${productId}`;
  let formatedPrice = price * 100;
  const payload = {
    name,
    description,
    price: formatedPrice,
    currency,
    availability,
    condition,
    image_url,
    access_token: ACCESS_TOKEN,
  };

  const response = await axios.post(url, payload);
  return response.data;
};

exports.createCatalogTemplate = async (
  wabaId,
  name,
  language,
  category,
  bodyText,
  token
) => {
  try {
    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

    const payload = {
      name,
      language,
      category,
      components: [
        {
          type: "BODY",
          text: bodyText,
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "CATALOG",
              text: "View catalog",
            },
          ],
        },
      ],
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(JSON.stringify(error.response.data));
    } else {
      throw new Error(error.message);
    }
  }
};

exports.sendCatalogTemplateMessage = async (
  to,
  parameters,
  PHONE_NUMBER_ID,
  TEMPLATE_NAME,
  ACCESS_TOKEN
) => {
  try {
    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: parameters.map((p) => ({ type: "text", text: p })),
          },
          {
            type: "button",
            sub_type: "catalog",
            index: "0",
          },
        ],
      },
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(JSON.stringify(error.response.data));
    } else {
      throw new Error(error.message);
    }
  }
};

// bulk  product  upload   / feeds

exports.createFeedOnMeta = async (catalogId, metaAccessToken, payload) => {
  try {
    const url = `https://graph.facebook.com/v23.0/${catalogId}/product_feeds`;

    const response = await axios.post(
      url,
      {
        name: payload.name,
        schedule: payload.schedule, // { interval, url, hour, ... }
      },
      {
        params: { access_token: metaAccessToken },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error creating feed:",
      error?.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

/**
 * Trigger a feed sync (upload) on Meta
 */
exports.syncFeedOnMeta = async (
  feedId,
  metaAccessToken,
  url,
  requestSchedule = false
) => {
  try {
    const apiUrl = `https://graph.facebook.com/v21.0/${catelogid}/product_feeds?fields=name,file_name,schedule,latest_upload,update_schedule,product_count`;

    const response = await axios.post(
      apiUrl,
      {
        request_schedule: requestSchedule,
        url: url,
      },
      {
        params: { access_token: metaAccessToken },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error syncing feed:",
      error?.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

/**
 * Update feed schedule / settings
 */
exports.updateFeedOnMeta = async (feedId, metaAccessToken, url) => {
  try {
    const apiUrl = `https://graph.facebook.com/v21.0/${feedId}/uploads`;
console.log("feedId, metaAccessToken, url", feedId, metaAccessToken, url);
    const response = await axios.post(
      apiUrl,
      {
        request_schedule: false,
        url, // shorthand for url: url
      },
      {
        params: { access_token: metaAccessToken },
      }
    );

    console.log("Meta API Update Feed Success:", response.data);
    return response.data; // ✅ only return data
  } catch (error) {
    console.error(
      "Error updating feed:",
      error?.response?.data || error.message
    );
    throw error.response?.data || { message: error.message };
  }
};

exports.getFeedFromMeta = async (feedId, metaAccessToken) => {
  try {
    const fields =
      "name,file_name,schedule,latest_upload,update_schedule,product_count";

    const apiUrl = `https://graph.facebook.com/v21.0/${feedId}?fields=${fields}&access_token=${metaAccessToken}`;

    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching feed:",
      error?.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};

exports.listFeedsFromMeta = async (catalogId, metaAccessToken) => {
  try {
    const url = `https://graph.facebook.com/v21.0/${catalogId}/product_feeds`;
    const response = await axios.get(url, {
      params: {
        access_token: metaAccessToken,
        fields:
          "name,file_name,schedule,latest_upload,update_schedule,product_count",
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error listing feeds:",
      error?.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};
