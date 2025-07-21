const User = require('../models/User');
const { sendEmail } = require('../functions/functions');
const generateToken = require('../utils/generateToken');
const { statusCode, resMessage } = require('../config/constants');

exports.register = async (req) => {
    const { username, email, password } = req.body;
    const tenantId = req.tenant._id;

    try {
        const userExists = await User.findOne({ email, tenantId });
        if (userExists) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.USER_EXISTS,
                statusCode: statusCode.BAD_REQUEST
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = await User.create({
            tenantId,
            username,
            email,
            password,
            role: 'user',
            otp: otp,
        });

        if (user) {
            const subject = 'Wachat Account OTP Verification';
            const text = `Hello ${username},\n\nYour OTP for Wachat is: ${otp}`;
            const html = `
                <h2>Hello ${username},</h2>
                <p>Your OTP for Wachat registration is:</p>
                <h3>${otp}</h3>
                <p>This OTP will expire in 10 minutes.</p>
            `;

            await sendEmail(email, subject, text, html);

            return {
                status: statusCode.CREATED,
                success: true,
                message: resMessage.OTP_SENT_SUCCESSFULLY_TO_EMAIL,
                data: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    token: generateToken(user._id)
                },
                statusCode: statusCode.CREATED
            }
        } else {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_user_data,
                statusCode: statusCode.BAD_REQUEST
            }
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};