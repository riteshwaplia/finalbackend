const nodemailer = require('nodemailer');
const axios = require('axios');

exports.traverseFlow = async (entryPointMessage, nodes, edges) => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const messages = [];

  const entryNode = nodes.find(
    n => n.data?.message?.toLowerCase() === entryPointMessage.toLowerCase()
  );
  if (!entryNode) return [];

  let current = nodeMap.get(edges.find(e => e.source === entryNode.id)?.target);

  while (current && current.data) {
  const { type, data } = current;
  const delay = data.meta?.delay || 0;

  if (type === 'text') {
    const text = data.message;
    if (text) {
      messages.push({ type: 'text', text, delay });
    }

  } else if (type === 'image') {
    const mediaId = data.id;
    const url = data.imageUrl || data.url;
    const caption = data.message || data.caption || '';

    if (url || mediaId) {
      messages.push({
        type: 'image',
        id: mediaId,
        link: url,
        caption,
        delay
      });
    }

  } else if (type === 'audio') {
    const audioId = data?.audioId;
    const audioUrl = data.audioUrl || data.url;
    if (audioId || audioUrl) {
        messages.push({
        type: 'audio',
        id: audioId,
        link: audioUrl,
        delay
      });
    }
    
  } else if (type === 'template') {
    const { selectedTemplateId, selectedTemplateName, selectedTemplateLanguage, parameters = [] } = data;
    if (selectedTemplateId && selectedTemplateName) {
      messages.push({
        type: 'template',
        templateId: selectedTemplateId,
        templateName: selectedTemplateName,
        templateLang: selectedTemplateLanguage,
        parameters,
        delay
      });
    }

  } else if (type === 'video') {
    const videoId = data.videoId;
    const caption = data.message || '';
    if (videoId) {
      messages.push({
        type: 'video',
        id: videoId,
        caption,
        delay
      });
    }
  }

  const nextEdge = edges.find(e => e.source === current.id);
  if (!nextEdge) break;

  current = nodeMap.get(nextEdge.target);
}

  return messages;
};

exports.sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.USER_EMAIL,   
        pass: process.env.PASS_EMAIL      
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: '"Devesh Kumar" <deveshtesting9672@gmail.com>',
      to,
      subject,
      text,
      html
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

exports.createAuthTemplate = async (templateName, otp_type, language, wabaId, accessToken) => {
  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;

  const payload = {
    name: templateName,
    language: language,
    category: 'AUTHENTICATION',
    components: [
      {
        type: 'BODY',
        example: {
          body_text: [['123456']]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'OTP',
            otp_type: otp_type
          }
        ]
      }
    ]
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
      if (error.response) {
        console.error('Meta API Error Response:', {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        console.error('Error making request:', error.message);
      }

      throw new Error(error?.response?.data?.error?.message || 'Failed to create template on Meta');
    }
}
