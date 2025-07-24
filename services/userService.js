const User = require('../models/User');
const { sendEmail } = require('../functions/functions');
const generateToken = require('../utils/generateToken');
const { statusCode, resMessage } = require('../config/constants');

exports.register = async (req) => {
    const { username, email, password } = req.body;
    const tenantId = req.tenant._id;

    try {
        const existingUser = await User.findOne({ email, tenantId });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        if (existingUser) {
            if (existingUser.isEmailVerified) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: resMessage.USER_EXISTS,
                    statusCode: statusCode.BAD_REQUEST
                };
            }

            existingUser.otp = otp;
            await existingUser.save();

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
                status: statusCode.OK,
                success: true,
                message: resMessage.OTP_SENT_SUCCESSFULLY_TO_EMAIL,
                data: {
                    _id: existingUser._id,
                    username: existingUser.username,
                    email: existingUser.email,
                    role: existingUser.role,
                    token: generateToken(existingUser._id)
                },
                statusCode: statusCode.OK
            };
        }

        const user = await User.create({
            tenantId,
            username,
            email,
            password,
            role: 'user',
            otp: otp,
        });

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
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};

exports.verifyOtp = async (req) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email, isEmailVerified: false });
    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.EMAIL_NOT_FOUND,
        statusCode: statusCode.NOT_FOUND
      };
    }

    if (String(user.otp) !== String(otp)) {
      return {
        status: statusCode.UNAUTHORIZED,
        success: false,
        message: resMessage.Invalid_otp,
        statusCode: statusCode.UNAUTHORIZED
      };
    }

    user.otp = null;
    user.isEmailVerified = true;
    await user.save();

    return {
      id: user._id,
      status: statusCode.OK,
      success: true,
      message: resMessage.otp_verified_successfully,
      statusCode: statusCode.OK
    };

  } catch (err) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: err.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

exports.resetPassword = async (req) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user._id;
        const tenantId = req.tenant._id;

        if (!oldPassword || !newPassword) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.MISSING_FIELDS || 'Old and new passwords are required.',
                statusCode: statusCode.BAD_REQUEST
            };
        }

        const user = await User.findOne({ _id: userId, tenantId });

        if (!user) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.USER_NOT_FOUND || 'User not found.',
                statusCode: statusCode.NOT_FOUND
            };
        }

        const isMatch = await user.matchPassword(oldPassword);

        if (!isMatch) {
            return {
                status: statusCode.UNAUTHORIZED,
                success: false,
                message: resMessage.INVALID_OLD_PASSWORD || 'Old password is incorrect.',
                statusCode: statusCode.UNAUTHORIZED
            };
        }

        user.password = newPassword;
        await user.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.PASSWORD_UPDATED_SUCCESSFULLY || 'Password updated successfully.',
            statusCode: statusCode.OK
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};

exports.forgotPassword = async (req) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.EMAIL_NOT_FOUND || 'Email not registered',
        statusCode: statusCode.NOT_FOUND
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();

    const subject = 'Wachat Password Reset OTP';
    const text = `Hello ${user.username},\n\nYour OTP to reset your password is: ${otp}`;
    const html = `
      <h2>Hello ${user.username},</h2>
      <p>Your OTP to reset your password is:</p>
      <h3>${otp}</h3>
      <p>This OTP will expire soon. Please use it promptly.</p>
    `;

    await sendEmail(email, subject, text, html);

    return {
      status: statusCode.OK,
      success: true,
      message: 'OTP sent successfully to email',
      statusCode: statusCode.OK
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};


exports.updatePasswordWithOtp = async (req) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: 'User not found',
        statusCode: statusCode.NOT_FOUND
      };
    }

    if (String(user.otp) !== String(otp)) {
      return {
        status: statusCode.UNAUTHORIZED,
        success: false,
        message: 'Invalid OTP',
        statusCode: statusCode.UNAUTHORIZED
      };
    }

    user.password = newPassword;
    user.otp = null; 
    await user.save();

    return {
      status: statusCode.OK,
      success: true,
      message: 'Password updated successfully',
      statusCode: statusCode.OK
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

