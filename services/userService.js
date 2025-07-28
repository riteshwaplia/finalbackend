const User = require('../models/User');
const { sendEmail } = require('../functions/functions');
const generateToken = require('../utils/generateToken');
const { statusCode, resMessage } = require('../config/constants');
const BusinessProfile = require('../models/BusinessProfile');

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

    const userd = await User.findOne({ email, isEmailVerified: true });
    if (userd) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Email_already_registered,
        statusCode: statusCode.NOT_FOUND
      };
    }

    const user = await User.findOne({ email, isEmailVerified: false });
    if (user) {
      if (user.otp !== otp) {
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
    }

  } catch (err) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: err.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

exports.updateBusinessProfile = async (req) => {
    const businessProfileId = req.params.id;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const { name, businessAddress, metaAccessToken, metaAppId } = req.body;
    try {
      const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
  
      if (!businessProfile) {
        return {
          status: statusCode.NOT_FOUND,
          success: false,
          message: resMessage.Business_profile_not_found
        };
      }
  
      if (name && name !== businessProfile.name) {
        const conflict = await BusinessProfile.findOne({ name, userId, tenantId, _id: { $ne: businessProfileId } });
        if (conflict) {
          return {
            status: statusCode.CONFLICT,
            success: false,
            message: "Another business profile with this name already exists."
          };
        }
      }
  
      Object.assign(businessProfile, {
        name: name ?? businessProfile.name,
        businessAddress: businessAddress ?? businessProfile.businessAddress,
        metaAccessToken: metaAccessToken ?? businessProfile.metaAccessToken,
        metaAppId: metaAppId ?? businessProfile.metaAppId,
        metaBusinessId: businessProfile.metaBusinessId
      });
  
      await businessProfile.save();
      
      return {
        status: statusCode.OK,
        success: true,
        message: resMessage.Business_profile_updated_successfully,
        data: businessProfile.toObject()
      };
    } catch (error) {
      console.error("Update BusinessProfile error:", error);
        return {
          status: statusCode.INTERNAL_SERVER_ERROR,
          success: false,
          message: error.message || resMessage.Server_error
        };
    }
}