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

  while (current) {
    const type = current.type;
    const delay = current.data?.meta?.delay || 0;

    if (type === 'text') {
      const text = current.data?.message;
      if (text) {
        messages.push({
          type: 'text',
          text,
          delay
        });
      }

    } else if (type === 'image') {
      const mediaId = current.data?.id;
      const url = current.data?.imageUrl || current.data?.url;
      const caption = current.data?.message || current.data?.caption || '';
      if (url) {
        messages.push({
          type: 'image',
          id: mediaId,
          link: url,
          caption,
          delay
        });
      }

    } else if (type === 'template') {
      const templateId = current.data?.selectedTemplateId;
      const templateName = current.data?.selectedTemplateName;
      const templateLang = current.data?.selectedTemplateLanguage;
      const parameters = current.data?.parameters || [];

      if (templateId && templateName) {
        messages.push({
          type: 'template',
          templateId,
          templateName,
          templateLang,
          parameters,
          delay
        });
      }
    } else if (type === 'VideoEditorNode') {
      const url = current.data?.videoUrl;
      const caption = current.data?.message || '';
      if (url) {
        messages.push({
          type: 'video',
          link: url,
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
